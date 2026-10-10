const Order = require('../models/Order');
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
require('../models/MasterProduct');
require('../models/Category');
const Payment = require('../models/Payment');
const Counter = require('../models/Counter');
const pricingService = require('./pricingService');
const geoService = require('./geoService');
const { emitOrderNew, emitOrderStatus, emitOrderItemsChanged } = require('../sockets');
const {
  PLACED,
  ACCEPTED,
  PACKING,
  READY,
  OUT_FOR_DELIVERY,
  DELIVERED,
  AWAITING_CUSTOMER,
  REJECTED,
  CANCELLED,
  EXPIRED,
  DELIVERY_FAILED,
  TERMINAL_STATUSES,
} = require('../constants/orderStatus');
const AppError = require('../utils/AppError');

// Valid state machine transitions table
const VALID_TRANSITIONS = {
  [PLACED]: {
    [ACCEPTED]: ['store'],
    [REJECTED]: ['store'],
    [CANCELLED]: ['customer', 'admin'],
    [EXPIRED]: ['system'],
  },
  [ACCEPTED]: {
    [PACKING]: ['store'],
    [AWAITING_CUSTOMER]: ['store'],
    [CANCELLED]: ['customer', 'admin'],
  },
  [PACKING]: {
    [READY]: ['store'],
    [AWAITING_CUSTOMER]: ['store'],
    [CANCELLED]: ['admin'],
  },
  [AWAITING_CUSTOMER]: {
    [PACKING]: ['customer'],
    [CANCELLED]: ['customer', 'system', 'admin'],
  },
  [READY]: {
    [OUT_FOR_DELIVERY]: ['store'], // delivery orders only
    [DELIVERED]: ['store'], // pickup orders only
    [CANCELLED]: ['admin'],
  },
  [OUT_FOR_DELIVERY]: {
    [DELIVERED]: ['store'],
    [DELIVERY_FAILED]: ['store'],
    [CANCELLED]: ['admin'],
  },
};

/**
 * Single authoritative transition function.
 * Uses atomic conditional findOneAndUpdate({ _id, status: expectedStatus }).
 * On no match returns 409 "already changed".
 */
async function transition(
  orderId,
  toStatus,
  { actor, role, expectedStatus, note, rejectReason } = {},
) {
  if (!orderId) {
    throw new AppError(400, 'BAD_REQUEST', 'Order ID is required');
  }

  // 1. Fetch current order to verify ownership, terminal status, and expectedStatus
  const order = await Order.findById(orderId).populate('store');
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }

  // Terminal statuses never change
  if (TERMINAL_STATUSES.includes(order.status)) {
    throw new AppError(
      400,
      'TERMINAL_STATUS',
      `Order is in terminal status ${order.status} and cannot be modified`,
    );
  }

  // Check expectedStatus against current status
  if (expectedStatus && order.status !== expectedStatus) {
    throw new AppError(409, 'STATUS_CONFLICT', 'Order status has already changed');
  }

  const currentStatus = order.status;

  // 2. Validate transition table permissions
  const allowedRoles = VALID_TRANSITIONS[currentStatus]?.[toStatus];
  if (!allowedRoles || !allowedRoles.includes(role)) {
    throw new AppError(
      400,
      'INVALID_TRANSITION',
      `Cannot transition from ${currentStatus} to ${toStatus} with role ${role}`,
    );
  }

  // 3. Validate specific fulfilment rules
  if (currentStatus === READY) {
    if (toStatus === OUT_FOR_DELIVERY && order.fulfilment !== 'delivery') {
      throw new AppError(
        400,
        'INVALID_TRANSITION',
        'Pickup orders cannot transition to OUT_FOR_DELIVERY',
      );
    }
    if (toStatus === DELIVERED && order.fulfilment !== 'pickup') {
      throw new AppError(
        400,
        'INVALID_TRANSITION',
        'Delivery orders must transition to OUT_FOR_DELIVERY before DELIVERED',
      );
    }
  }

  // 4. Ownership validation
  if (role === 'customer') {
    const actorId = String(actor?._id || actor);
    if (String(order.customer) !== actorId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the owning customer may modify this order');
    }
  } else if (role === 'store') {
    const actorId = String(actor?._id || actor);
    const storeOwnerId = String(order.store.owner || order.store._id);
    const orderStoreId = String(order.store._id || order.store);
    // Allow either the store owner user ID or the store ID itself
    if (storeOwnerId !== actorId && orderStoreId !== actorId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the owning store may modify this order');
    }
  }

  // 5. Atomic transition update
  const updateQuery = {
    _id: orderId,
    status: currentStatus,
  };

  const updateDoc = {
    $set: {
      status: toStatus,
    },
    $push: {
      statusHistory: {
        status: toStatus,
        at: new Date(),
        by: actor?._id || (role === 'system' ? null : actor),
        byRole: role,
        note: note || '',
      },
    },
  };

  if (toStatus === REJECTED && rejectReason) {
    updateDoc.$set.rejectReason = rejectReason;
  }

  if (toStatus === AWAITING_CUSTOMER) {
    // 10 minutes timeout for customer confirmation
    updateDoc.$set.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  }

  const updatedOrder = await Order.findOneAndUpdate(updateQuery, updateDoc, { new: true })
    .populate('store', 'name slug phone address owner')
    .populate('customer', 'name phone email');

  if (!updatedOrder) {
    throw new AppError(409, 'STATUS_CONFLICT', 'Order status has already changed');
  }

  // Handle mock refunds for prepaid orders
  if (updatedOrder.paymentMethod !== 'COD' && updatedOrder.payment) {
    const payment = await Payment.findById(updatedOrder.payment);
    if (payment) {
      if ([REJECTED, CANCELLED, EXPIRED].includes(toStatus)) {
        payment.status = 'REFUNDED';
        payment.refundAmount = payment.amount;
        await payment.save();

        updatedOrder.paymentStatus = 'REFUNDED';
        updatedOrder.refundAmount = payment.amount;
        await updatedOrder.save();
      } else if (
        currentStatus === AWAITING_CUSTOMER &&
        toStatus === PACKING &&
        payment.amount > updatedOrder.total
      ) {
        const refundDiff = payment.amount - updatedOrder.total;
        payment.status = 'PARTIALLY_REFUNDED';
        payment.refundAmount = refundDiff;
        await payment.save();

        updatedOrder.paymentStatus = 'PARTIALLY_REFUNDED';
        updatedOrder.refundAmount = refundDiff;
        await updatedOrder.save();
      }
    }
  }

  // Socket.IO real-time emission
  emitOrderStatus(updatedOrder);
  if (toStatus === AWAITING_CUSTOMER) {
    emitOrderItemsChanged(updatedOrder);
  }

  return updatedOrder;
}

/**
 * Create a new order.
 * - Customer only (store owner cannot order from own store)
 * - Server is single source of truth for items, prices, and bill
 * - Recomputes bill via pricingService
 * - Enforces minimum order and stock
 * - Enforces SUCCESS payment matching order total
 * - Idempotent by (customer, idempotencyKey)
 */
async function createOrder({
  user,
  storeId,
  items,
  fulfilment,
  addressId,
  note = '',
  paymentId,
  idempotencyKey,
}) {
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required to create order');
  }

  if (!idempotencyKey || !idempotencyKey.trim()) {
    throw new AppError(400, 'BAD_REQUEST', 'Idempotency key is required');
  }

  // 1. Check idempotency: if order exists for this customer + key, return it
  const existingOrder = await Order.findOne({
    customer: user._id,
    idempotencyKey: idempotencyKey.trim(),
  }).populate('store', 'name slug phone address');

  if (existingOrder) {
    return existingOrder;
  }

  // 2. Validate store
  const store = await Store.findOne({ _id: storeId, status: 'approved' }).populate(
    'owner',
    'isBlocked',
  );
  if (!store || store.owner?.isBlocked) {
    throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found or not approved');
  }

  // Store owner cannot order from their own store
  if (String(store.owner) === String(user._id)) {
    throw new AppError(403, 'FORBIDDEN', 'Store owners cannot place orders from their own store');
  }

  // Validate store is currently open
  const { isOpenNow } = geoService.checkStoreOpenStatus(store);
  if (!isOpenNow || !store.isOpen) {
    throw new AppError(400, 'STORE_CLOSED', 'Store is currently closed and not accepting orders');
  }

  // 3. Validate fulfilment & address
  let addressSnapshot = null;
  if (fulfilment === 'delivery') {
    if (!store.supportsDelivery) {
      throw new AppError(400, 'DELIVERY_NOT_SUPPORTED', 'Store does not support home delivery');
    }

    if (!addressId) {
      throw new AppError(400, 'ADDRESS_REQUIRED', 'Delivery address is required for home delivery');
    }

    const addr = user.addresses?.id(addressId);
    if (!addr) {
      throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Selected delivery address not found');
    }

    // Verify distance from store
    const storeCoords = store.location.coordinates;
    const addrCoords = addr.location.coordinates;
    const distanceKm = geoService.calculateDistanceKm(addrCoords, storeCoords);

    if (distanceKm > store.deliveryRadiusKm) {
      throw new AppError(
        400,
        'OUTSIDE_DELIVERY_RADIUS',
        `Address is ${distanceKm.toFixed(1)} km away, outside store delivery radius of ${store.deliveryRadiusKm} km`,
      );
    }

    addressSnapshot = {
      label: addr.label,
      line: addr.line,
      pincode: addr.pincode,
      landmark: addr.landmark || '',
      location: {
        type: 'Point',
        coordinates: addrCoords,
      },
    };
  } else if (fulfilment === 'pickup') {
    if (!store.supportsPickup) {
      throw new AppError(400, 'PICKUP_NOT_SUPPORTED', 'Store does not support store pickup');
    }
  } else {
    throw new AppError(400, 'INVALID_FULFILMENT', 'Fulfilment must be delivery or pickup');
  }

  // 4. Validate items and reload fresh prices from DB
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'EMPTY_ORDER', 'Order must contain at least one product');
  }

  const storeProductIds = items.map((i) => i.storeProductId);
  const storeProducts = await StoreProduct.find({
    _id: { $in: storeProductIds },
    store: store._id,
    isActive: true,
  }).populate('masterProduct');

  const spMap = new Map(storeProducts.map((sp) => [String(sp._id), sp]));

  const orderItemsSnapshot = [];
  const billableItems = [];

  for (const item of items) {
    const sp = spMap.get(String(item.storeProductId));
    if (!sp) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product not found in this store's catalogue`);
    }

    if (!sp.inStock) {
      const name = sp.masterProduct?.name || sp.customName;
      throw new AppError(422, 'OUT_OF_STOCK', `Item "${name}" is currently out of stock`);
    }

    const qty = Math.max(1, Math.min(10, Number(item.qty) || 1));
    const isMaster = Boolean(sp.masterProduct);
    const master = sp.masterProduct;
    const name = isMaster ? master.name : sp.customName;
    const nameTe = isMaster ? master.nameTe || '' : '';
    const unit = isMaster ? master.unit || '1 pc' : '1 pc';

    orderItemsSnapshot.push({
      storeProductId: sp._id,
      name,
      nameTe,
      unit,
      price: sp.price,
      qty,
      available: true,
    });

    billableItems.push({
      price: sp.price,
      mrp: sp.mrp,
      qty,
    });
  }

  // 5. Recompute authoritative bill
  const bill = pricingService.computeBill(store, billableItems, fulfilment);
  if (bill.subtotal < store.minOrder) {
    throw new AppError(
      400,
      'BELOW_MIN_ORDER',
      `Order subtotal does not meet the store minimum order of ₹${(store.minOrder / 100).toFixed(0)}`,
    );
  }

  // 6. Verify payment record
  if (!paymentId) {
    throw new AppError(400, 'PAYMENT_REQUIRED', 'Payment reference is required');
  }

  const payment = await Payment.findOne({
    _id: paymentId,
    user: user._id,
    status: 'SUCCESS',
  });

  if (!payment) {
    throw new AppError(400, 'INVALID_PAYMENT', 'No successful payment record found for this order');
  }

  if (payment.order) {
    throw new AppError(
      400,
      'PAYMENT_ALREADY_LINKED',
      'This payment record is already attached to another order',
    );
  }

  if (payment.amount !== bill.total) {
    throw new AppError(
      400,
      'PAYMENT_AMOUNT_MISMATCH',
      `Payment amount (${payment.amount}) does not match order total (${bill.total})`,
    );
  }

  // 7. Generate order number and expiry (now + 3 minutes for store to respond)
  const orderNo = await Counter.getNextOrderNo();
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

  // 8. Create Order record
  try {
    const order = await Order.create({
      orderNo,
      customer: user._id,
      store: store._id,
      items: orderItemsSnapshot,
      addressSnapshot,
      fulfilment,
      deliveryNote: note || '',
      subtotal: bill.subtotal,
      deliveryFee: bill.deliveryFee,
      total: bill.total,
      payment: payment._id,
      paymentMethod: payment.method,
      paymentStatus: payment.status,
      status: PLACED,
      statusHistory: [
        {
          status: PLACED,
          at: new Date(),
          by: user._id,
          byRole: 'customer',
          note: note || 'Order placed',
        },
      ],
      expiresAt,
      idempotencyKey: idempotencyKey.trim(),
    });

    // Link payment to this order
    payment.order = order._id;
    await payment.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('store', 'name slug phone address owner')
      .populate('customer', 'name phone email');

    // Real-time socket emission
    emitOrderNew(store._id, populatedOrder || order);
    emitOrderStatus(populatedOrder || order);

    return populatedOrder || order;
  } catch (err) {
    // If concurrent insert with same idempotencyKey happened, return the existing order
    if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
      const raceOrder = await Order.findOne({
        customer: user._id,
        idempotencyKey: idempotencyKey.trim(),
      });
      if (raceOrder) return raceOrder;
    }
    throw err;
  }
}

module.exports = {
  transition,
  createOrder,
  VALID_TRANSITIONS,
};
