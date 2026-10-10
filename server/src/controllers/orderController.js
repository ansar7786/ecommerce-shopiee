const mongoose = require('mongoose');
const { z } = require('zod');
const Order = require('../models/Order');
const StoreProduct = require('../models/StoreProduct');
const orderService = require('../services/orderService');
const { CANCELLED, TERMINAL_STATUSES } = require('../constants/orderStatus');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const createOrderSchema = z.object({
  storeId: z.string().trim().min(1, 'Store ID is required'),
  items: z
    .array(
      z.object({
        storeProductId: z.string().trim().min(1, 'Store product ID is required'),
        qty: z
          .number({ invalid_type_error: 'Quantity must be a number' })
          .int('Quantity must be an integer')
          .min(1, 'Quantity must be at least 1')
          .max(10, 'Maximum 10 units per item'),
      }),
    )
    .min(1, 'At least one item is required in the order'),
  fulfilment: z.enum(['delivery', 'pickup']),
  addressId: z.string().optional(),
  note: z.string().max(200, 'Delivery note too long').optional(),
  paymentId: z.string().trim().min(1, 'Payment reference ID is required'),
  idempotencyKey: z.string().trim().min(1, 'Idempotency key is required'),
});

// POST /api/orders
const createOrder = asyncHandler(async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues.map((i) => i.message).join(', '),
    );
  }

  const order = await orderService.createOrder({
    user: req.user,
    ...parsed.data,
  });

  res.status(201).json({
    success: true,
    order,
  });
});

// GET /api/orders/my
const getMyOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('store', 'name slug photo phone address'),
    Order.countDocuments({ customer: req.user._id }),
  ]);

  res.status(200).json({
    success: true,
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// GET /api/orders/:id
const getOrderById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { $or: [{ _id: id }, { orderNo: id }] } : { orderNo: id };

  const order = await Order.findOne(query)
    .populate('store', 'name slug photo phone address owner timings isOpen')
    .populate('customer', 'name phone email');

  if (!order) {
    return next(new AppError(404, 'NOT_FOUND', 'Order not found'));
  }

  // Authorization: must be the customer, the store owner, or an admin
  const isCustomer = String(order.customer?._id || order.customer) === String(req.user._id);
  const isStoreOwner = String(order.store?.owner) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';

  if (!isCustomer && !isStoreOwner && !isAdmin) {
    return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to view this order'));
  }

  res.status(200).json({
    success: true,
    order,
  });
});

// PATCH /api/orders/:id/cancel
const cancelOrder = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { reason = 'Cancelled by user' } = req.body;

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { $or: [{ _id: id }, { orderNo: id }] } : { orderNo: id };

  const order = await Order.findOne(query);
  if (!order) {
    return next(new AppError(404, 'NOT_FOUND', 'Order not found'));
  }

  if (TERMINAL_STATUSES.includes(order.status)) {
    return next(
      new AppError(
        400,
        'TERMINAL_STATUS',
        `Order is in terminal status ${order.status} and cannot be cancelled`,
      ),
    );
  }

  const isCustomer = String(order.customer) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';

  if (!isCustomer && !isAdmin) {
    return next(
      new AppError(403, 'FORBIDDEN', 'Only the owning customer or an admin may cancel this order'),
    );
  }

  const role = isAdmin ? 'admin' : 'customer';

  const updatedOrder = await orderService.transition(order._id, CANCELLED, {
    actor: req.user,
    role,
    expectedStatus: order.status,
    note: reason,
  });

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    order: updatedOrder,
  });
});

// PATCH /api/orders/:id/status (for store transitions or admin override)
const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { toStatus, expectedStatus, note = '', rejectReason = '' } = req.body;

  if (!toStatus) {
    return next(new AppError(400, 'BAD_REQUEST', 'toStatus is required'));
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { $or: [{ _id: id }, { orderNo: id }] } : { orderNo: id };

  const order = await Order.findOne(query).populate('store');
  if (!order) {
    return next(new AppError(404, 'NOT_FOUND', 'Order not found'));
  }

  let role = req.user.role;
  if (req.user.role === 'store_owner') {
    // Verify owning store
    if (String(order.store.owner) !== String(req.user._id)) {
      return next(new AppError(403, 'FORBIDDEN', 'You can only update orders for your own store'));
    }
    role = 'store';
  }

  const updatedOrder = await orderService.transition(order._id, toStatus, {
    actor: req.user,
    role,
    expectedStatus: expectedStatus || order.status,
    note,
    rejectReason,
  });

  res.status(200).json({
    success: true,
    order: updatedOrder,
  });
});

// PATCH /api/orders/:id/respond-changes
const respondToChanges = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { accept } = req.body;

  if (typeof accept !== 'boolean') {
    return next(new AppError(400, 'BAD_REQUEST', 'accept boolean is required'));
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { $or: [{ _id: id }, { orderNo: id }] } : { orderNo: id };

  const order = await Order.findOne(query);
  if (!order) {
    return next(new AppError(404, 'NOT_FOUND', 'Order not found'));
  }

  if (String(order.customer) !== String(req.user._id)) {
    return next(new AppError(403, 'FORBIDDEN', 'Only the owning customer can respond to changes'));
  }

  if (order.status !== 'AWAITING_CUSTOMER') {
    return next(
      new AppError(
        400,
        'INVALID_STATUS',
        `Cannot respond to changes for order in status ${order.status}`,
      ),
    );
  }

  const toStatus = accept ? 'PACKING' : CANCELLED;
  const note = accept ? 'Customer accepted item changes' : 'Customer declined item changes';

  const updatedOrder = await orderService.transition(order._id, toStatus, {
    actor: req.user,
    role: 'customer',
    expectedStatus: 'AWAITING_CUSTOMER',
    note,
  });

  res.status(200).json({
    success: true,
    order: updatedOrder,
  });
});

// POST /api/orders/:id/reorder-check
const reorderCheck = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { $or: [{ _id: id }, { orderNo: id }] } : { orderNo: id };

  const order = await Order.findOne(query).populate('store');
  if (!order) {
    return next(new AppError(404, 'NOT_FOUND', 'Order not found'));
  }

  // Ensure user owns order or is admin
  if (String(order.customer) !== String(req.user._id) && req.user.role !== 'admin') {
    return next(new AppError(403, 'FORBIDDEN', 'Access denied'));
  }

  const productIds = order.items.map((i) => i.storeProductId).filter(Boolean);
  const currentProducts = await StoreProduct.find({
    _id: { $in: productIds },
  }).populate('masterProduct');

  const productMap = new Map();
  currentProducts.forEach((p) => {
    productMap.set(String(p._id), p);
  });

  const checkedItems = order.items.map((item) => {
    const current = productMap.get(String(item.storeProductId));
    const available = Boolean(current && current.isActive);
    const inStock = Boolean(available && current.inStock);

    return {
      storeProductId: item.storeProductId,
      name: item.name,
      nameTe: item.nameTe || '',
      unit: item.unit || '1 pc',
      originalPrice: item.price,
      currentPrice: current ? current.price : item.price,
      currentMrp: current ? current.mrp : item.price,
      qty: item.qty,
      inStock,
      available,
      image: current?.masterProduct?.image || current?.customImage || null,
    };
  });

  res.status(200).json({
    success: true,
    store: {
      id: order.store._id,
      name: order.store.name,
      slug: order.store.slug,
      isOpen: order.store.isOpen,
      deliveryFee: order.store.deliveryFee,
      freeDeliveryAbove: order.store.freeDeliveryAbove,
      minOrder: order.store.minOrder,
      supportsDelivery: order.store.supportsDelivery,
      supportsPickup: order.store.supportsPickup,
    },
    items: checkedItems,
  });
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  respondToChanges,
  reorderCheck,
};
