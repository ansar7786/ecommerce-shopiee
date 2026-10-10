const Order = require('../models/Order');
const Store = require('../models/Store');
const Payment = require('../models/Payment');
const orderService = require('../services/orderService');
const {
  PLACED,
  ACCEPTED,
  PACKING,
  READY,
  OUT_FOR_DELIVERY,
  DELIVERED,
  AWAITING_CUSTOMER,
  CANCELLED,
  REJECTED,
  DELIVERY_FAILED,
} = require('../constants/orderStatus');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { emitOrderStatus } = require('../sockets');

// Helper to find store for logged-in store owner
async function getOwnerStore(userId) {
  const store = await Store.findOne({ owner: userId });
  if (!store) {
    throw new AppError(404, 'NOT_FOUND', 'No store associated with your account');
  }
  return store;
}

// GET /api/store/orders?status
const getStoreOrders = asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.user._id);
  const { status } = req.query;

  const baseQuery = { store: store._id };

  if (status) {
    if (status === 'new') {
      baseQuery.status = PLACED;
    } else if (status === 'preparing') {
      baseQuery.status = { $in: [ACCEPTED, PACKING, AWAITING_CUSTOMER] };
    } else if (status === 'ready-out') {
      baseQuery.status = { $in: [READY, OUT_FOR_DELIVERY] };
    } else if (status === 'done') {
      baseQuery.status = {
        $in: [DELIVERED, REJECTED, CANCELLED, 'EXPIRED', DELIVERY_FAILED],
      };
    } else {
      baseQuery.status = status;
    }
  }

  const [orders, counts] = await Promise.all([
    Order.find(baseQuery).sort({ createdAt: -1 }).populate('customer', 'name phone email'),
    Order.aggregate([
      { $match: { store: store._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const countMap = {};
  counts.forEach((c) => {
    countMap[c._id] = c.count;
  });

  const tabCounts = {
    new: countMap[PLACED] || 0,
    preparing:
      (countMap[ACCEPTED] || 0) + (countMap[PACKING] || 0) + (countMap[AWAITING_CUSTOMER] || 0),
    readyOut: (countMap[READY] || 0) + (countMap[OUT_FOR_DELIVERY] || 0),
    done:
      (countMap[DELIVERED] || 0) +
      (countMap[REJECTED] || 0) +
      (countMap[CANCELLED] || 0) +
      (countMap['EXPIRED'] || 0) +
      (countMap[DELIVERY_FAILED] || 0),
  };

  res.status(200).json({
    success: true,
    orders,
    tabCounts,
  });
});

// GET /api/store/orders/:id
const getStoreOrderById = asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.user._id);
  const { id } = req.params;

  const order = await Order.findOne({ _id: id, store: store._id }).populate(
    'customer',
    'name phone email',
  );
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found for this store');
  }

  res.status(200).json({
    success: true,
    order,
  });
});

// PATCH /api/store/orders/:id/accept
const acceptOrder = asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.user._id);
  const { id } = req.params;

  const order = await Order.findOne({ _id: id, store: store._id });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found for this store');
  }

  const updatedOrder = await orderService.transition(order._id, ACCEPTED, {
    actor: req.user,
    role: 'store',
    expectedStatus: PLACED,
    note: 'Accepted by store',
  });

  res.status(200).json({
    success: true,
    order: updatedOrder,
  });
});

// PATCH /api/store/orders/:id/reject
const rejectOrder = asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.user._id);
  const { id } = req.params;
  const { reason = 'Rejected by store' } = req.body;

  const order = await Order.findOne({ _id: id, store: store._id });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found for this store');
  }

  const updatedOrder = await orderService.transition(order._id, REJECTED, {
    actor: req.user,
    role: 'store',
    expectedStatus: PLACED,
    rejectReason: reason,
    note: reason,
  });

  res.status(200).json({
    success: true,
    order: updatedOrder,
  });
});

// PATCH /api/store/orders/:id/status
const updateStatus = asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.user._id);
  const { id } = req.params;
  const { to, expectedStatus, note = '' } = req.body;

  if (!to) {
    throw new AppError(400, 'BAD_REQUEST', 'Target status (to) is required');
  }

  const order = await Order.findOne({ _id: id, store: store._id });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found for this store');
  }

  const updatedOrder = await orderService.transition(order._id, to, {
    actor: req.user,
    role: 'store',
    expectedStatus: expectedStatus || order.status,
    note,
  });

  res.status(200).json({
    success: true,
    order: updatedOrder,
  });
});

// PATCH /api/store/orders/:id/items/:itemId/unavailable
const markItemUnavailable = asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.user._id);
  const { id, itemId } = req.params;

  const order = await Order.findOne({ _id: id, store: store._id });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found for this store');
  }

  // Find item by storeProductId or by index
  let targetItem = order.items.find(
    (i) => String(i.storeProductId) === String(itemId) || String(i._id) === String(itemId),
  );

  if (!targetItem) {
    throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found in order');
  }

  targetItem.available = false;

  // Check if any items remain available
  const availableItems = order.items.filter((i) => i.available !== false);

  if (availableItems.length === 0) {
    // If no available items remain, cancel the order instead
    await order.save();
    const cancelledOrder = await orderService.transition(order._id, CANCELLED, {
      actor: req.user,
      role: 'store',
      expectedStatus: order.status,
      note: 'All items marked unavailable by store',
    });

    return res.status(200).json({
      success: true,
      message: 'All items unavailable; order cancelled',
      order: cancelledOrder,
    });
  }

  // Recompute subtotal and total, keeping original delivery fee
  const newSubtotal = availableItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  order.subtotal = newSubtotal;
  order.total = newSubtotal + order.deliveryFee;
  await order.save();

  // Move order to AWAITING_CUSTOMER
  const updatedOrder = await orderService.transition(order._id, AWAITING_CUSTOMER, {
    actor: req.user,
    role: 'store',
    expectedStatus: order.status,
    note: `Item ${targetItem.name} marked unavailable`,
  });

  res.status(200).json({
    success: true,
    message: 'Item marked unavailable; awaiting customer confirmation',
    order: updatedOrder,
  });
});

// PATCH /api/store/orders/:id/payment-collected
const markPaymentCollected = asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.user._id);
  const { id } = req.params;

  const order = await Order.findOne({ _id: id, store: store._id });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found for this store');
  }

  if (order.paymentMethod !== 'COD') {
    throw new AppError(400, 'BAD_REQUEST', 'Only COD orders require payment collection');
  }

  // Allow payment collected at delivery or delivered
  if (![READY, OUT_FOR_DELIVERY, DELIVERED].includes(order.status)) {
    throw new AppError(
      400,
      'BAD_REQUEST',
      'Payment collection can only be confirmed during delivery or handover',
    );
  }

  order.paymentStatus = 'SUCCESS';
  await order.save();

  if (order.payment) {
    await Payment.findByIdAndUpdate(order.payment, { status: 'SUCCESS' });
  }

  emitOrderStatus(order);

  res.status(200).json({
    success: true,
    message: 'Payment collection recorded',
    order,
  });
});

// PATCH /api/store/orders/:id/delivery-failed
const deliveryFailed = asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.user._id);
  const { id } = req.params;
  const { reason = 'Customer unreachable' } = req.body;

  const order = await Order.findOne({ _id: id, store: store._id });
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found for this store');
  }

  const updatedOrder = await orderService.transition(order._id, DELIVERY_FAILED, {
    actor: req.user,
    role: 'store',
    expectedStatus: OUT_FOR_DELIVERY,
    note: reason,
  });

  res.status(200).json({
    success: true,
    order: updatedOrder,
  });
});

module.exports = {
  getStoreOrders,
  getStoreOrderById,
  acceptOrder,
  rejectOrder,
  updateStatus,
  markItemUnavailable,
  markPaymentCollected,
  deliveryFailed,
};
