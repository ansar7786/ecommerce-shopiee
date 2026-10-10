const { z } = require('zod');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const MasterProduct = require('../models/MasterProduct');
const Store = require('../models/Store');
const User = require('../models/User');
const Order = require('../models/Order');
const Complaint = require('../models/Complaint');
const orderService = require('../services/orderService');
const { CANCELLED } = require('../constants/orderStatus');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { emitStoreApprovalStatus } = require('../sockets');

// Zod schemas
const categorySchema = z.object({
  name: z.string().trim().min(1, 'Category name in English is required').max(100),
  nameTe: z.string().trim().min(1, 'Category name in Telugu is required').max(100),
  icon: z.string().trim().min(1, 'Icon name is required').max(50),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

const categoryUpdateSchema = categorySchema.partial();

const masterProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name in English is required').max(200),
  nameTe: z.string().trim().min(1, 'Product name in Telugu is required').max(200),
  brand: z.string().trim().min(1, 'Brand is required').max(100),
  category: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), 'Invalid category ID'),
  unit: z.string().trim().min(1, 'Unit is required').max(50),
  mrp: z
    .number({ invalid_type_error: 'MRP must be a number' })
    .int('MRP must be an integer (in paise)')
    .positive('MRP must be greater than 0'),
  barcode: z.string().trim().optional().default(''),
  tags: z.array(z.string().trim()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

const masterProductUpdateSchema = masterProductSchema.partial();

// ==================== CATEGORIES CONTROLLERS ====================

const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
  res.status(200).json({
    success: true,
    categories,
  });
});

const createCategory = asyncHandler(async (req, res, next) => {
  const parseResult = categorySchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const category = await Category.create(parseResult.data);
  res.status(201).json({
    success: true,
    category,
  });
});

const updateCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError(400, 'INVALID_ID', 'Invalid category ID'));
  }

  const parseResult = categoryUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const category = await Category.findByIdAndUpdate(id, parseResult.data, {
    new: true,
    runValidators: true,
  });

  if (!category) {
    return next(new AppError(404, 'NOT_FOUND', 'Category not found'));
  }

  res.status(200).json({
    success: true,
    category,
  });
});

const deleteCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError(400, 'INVALID_ID', 'Invalid category ID'));
  }

  // Soft delete: set isActive to false
  const category = await Category.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!category) {
    return next(new AppError(404, 'NOT_FOUND', 'Category not found'));
  }

  res.status(200).json({
    success: true,
    message: 'Category deactivated successfully',
    category,
  });
});

// ==================== MASTER PRODUCTS CONTROLLERS ====================

const listMasterProducts = asyncHandler(async (req, res) => {
  const { q, category } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};

  if (category && mongoose.Types.ObjectId.isValid(category)) {
    filter.category = category;
  }

  if (q && q.trim()) {
    const searchRegex = new RegExp(q.trim(), 'i');
    filter.$or = [{ name: searchRegex }, { nameTe: searchRegex }, { brand: searchRegex }];
  }

  const [products, total] = await Promise.all([
    MasterProduct.find(filter)
      .populate('category', 'name nameTe icon')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    MasterProduct.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

const createMasterProduct = asyncHandler(async (req, res, next) => {
  const parseResult = masterProductSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  // Verify category exists
  const cat = await Category.findById(parseResult.data.category);
  if (!cat) {
    return next(new AppError(400, 'INVALID_CATEGORY', 'Referenced category does not exist'));
  }

  const product = await MasterProduct.create(parseResult.data);
  const populated = await product.populate('category', 'name nameTe icon');

  res.status(201).json({
    success: true,
    product: populated,
  });
});

const updateMasterProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError(400, 'INVALID_ID', 'Invalid product ID'));
  }

  const parseResult = masterProductUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  if (parseResult.data.category) {
    const cat = await Category.findById(parseResult.data.category);
    if (!cat) {
      return next(new AppError(400, 'INVALID_CATEGORY', 'Referenced category does not exist'));
    }
  }

  const product = await MasterProduct.findByIdAndUpdate(id, parseResult.data, {
    new: true,
    runValidators: true,
  }).populate('category', 'name nameTe icon');

  if (!product) {
    return next(new AppError(404, 'NOT_FOUND', 'Master product not found'));
  }

  res.status(200).json({
    success: true,
    product,
  });
});

const deleteMasterProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError(400, 'INVALID_ID', 'Invalid product ID'));
  }

  // Soft delete: set isActive to false
  const product = await MasterProduct.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true },
  ).populate('category', 'name nameTe icon');

  if (!product) {
    return next(new AppError(404, 'NOT_FOUND', 'Master product not found'));
  }

  res.status(200).json({
    success: true,
    message: 'Master product deactivated successfully',
    product,
  });
});

const updateProductImage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError(400, 'INVALID_ID', 'Invalid product ID'));
  }

  if (!req.file) {
    return next(new AppError(400, 'FILE_REQUIRED', 'Please upload an image file'));
  }

  const imagePath = `/uploads/products/${req.file.filename}`;

  const product = await MasterProduct.findByIdAndUpdate(
    id,
    { image: imagePath },
    { new: true },
  ).populate('category', 'name nameTe icon');

  if (!product) {
    return next(new AppError(404, 'NOT_FOUND', 'Master product not found'));
  }

  res.status(200).json({
    success: true,
    product,
  });
});

// ==================== STORES CONTROLLERS ====================

const listAdminStores = asyncHandler(async (req, res) => {
  const { status, q, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  if (status && status !== 'all') {
    filter.status = status;
  }

  if (q && q.trim()) {
    const regex = { $regex: q.trim(), $options: 'i' };
    filter.$or = [{ name: regex }, { phone: regex }, { address: regex }, { pincode: regex }];
  }

  const [stores, total, pendingCount, approvedCount, suspendedCount, rejectedCount] =
    await Promise.all([
      Store.find(filter)
        .populate('owner', 'name email phone photo isBlocked')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Store.countDocuments(filter),
      Store.countDocuments({ status: 'pending' }),
      Store.countDocuments({ status: 'approved' }),
      Store.countDocuments({ status: 'suspended' }),
      Store.countDocuments({ status: 'rejected' }),
    ]);

  res.status(200).json({
    success: true,
    stores,
    counts: {
      all: pendingCount + approvedCount + suspendedCount + rejectedCount,
      pending: pendingCount,
      approved: approvedCount,
      suspended: suspendedCount,
      rejected: rejectedCount,
    },
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

const getAdminStoreById = asyncHandler(async (req, res, next) => {
  const store = await Store.findById(req.params.id).populate(
    'owner',
    'name email phone photo isBlocked',
  );

  if (!store) {
    return next(new AppError(404, 'NOT_FOUND', 'Store not found'));
  }

  res.status(200).json({
    success: true,
    store,
  });
});

const updateAdminStoreStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const store = await Store.findById(id).populate('owner', 'name email phone photo isBlocked');

  if (!store) {
    return next(new AppError(404, 'NOT_FOUND', 'Store not found'));
  }

  const { action, status, rejectionReason } = req.body;

  let targetStatus = status;
  if (action === 'approve') targetStatus = 'approved';
  if (action === 'reject') targetStatus = 'rejected';
  if (action === 'suspend') targetStatus = 'suspended';
  if (action === 'reactivate') targetStatus = 'approved';

  if (!targetStatus || !['pending', 'approved', 'rejected', 'suspended'].includes(targetStatus)) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Valid status or action is required'));
  }

  // Block invalid transitions (e.g. approving an already approved store returns 409)
  if (store.status === targetStatus) {
    return next(new AppError(409, 'INVALID_TRANSITION', `Store is already ${targetStatus}`));
  }

  const ALLOWED_STORE_TRANSITIONS = {
    pending: ['approved', 'rejected'],
    approved: ['suspended'],
    suspended: ['approved'],
    rejected: [],
  };

  const allowed = ALLOWED_STORE_TRANSITIONS[store.status] || [];
  if (!allowed.includes(targetStatus)) {
    return next(
      new AppError(
        409,
        'INVALID_TRANSITION',
        `Cannot transition store from ${store.status} to ${targetStatus}`,
      ),
    );
  }

  if (targetStatus === 'rejected') {
    if (!rejectionReason || !rejectionReason.trim()) {
      return next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          'Rejection reason is required when rejecting a store',
        ),
      );
    }
    store.rejectionReason = rejectionReason.trim();
  } else if (targetStatus === 'approved') {
    store.rejectionReason = '';
  }

  store.status = targetStatus;
  await store.save();

  emitStoreApprovalStatus(store);

  res.status(200).json({
    success: true,
    message: `Store ${targetStatus} successfully`,
    store,
  });
});

// ==================== DASHBOARD STATS ====================

const getAdminStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fourteenDaysAgo = new Date(startOfToday.getTime() - 13 * 24 * 60 * 60 * 1000);

  const [totalUsers, approvedStores, pendingStores, rejectedStores, totalOrders, todayOrders] =
    await Promise.all([
      User.countDocuments(),
      Store.countDocuments({ status: 'approved' }),
      Store.countDocuments({ status: 'pending' }),
      Store.countDocuments({ status: 'rejected' }),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: startOfToday } }),
    ]);

  // GMV: sum of delivered orders total
  const gmvAgg = await Order.aggregate([
    { $match: { status: 'DELIVERED' } },
    { $group: { _id: null, gmv: { $sum: '$total' } } },
  ]);
  const gmv = gmvAgg[0]?.gmv || 0;

  // Last 14 days breakdown
  const last14DaysAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: fourteenDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        gmv: {
          $sum: {
            $cond: [{ $eq: ['$status', 'DELIVERED'] }, '$total', 0],
          },
        },
      },
    },
  ]);

  const map14 = new Map(last14DaysAgg.map((item) => [item._id, item]));
  const last14Days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const match = map14.get(dateStr);
    last14Days.push({
      date: dateStr,
      count: match?.count || 0,
      gmv: match?.gmv || 0,
    });
  }

  // Orders by status
  const statusAgg = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const ordersByStatus = {};
  statusAgg.forEach((item) => {
    ordersByStatus[item._id] = item.count;
  });

  res.status(200).json({
    success: true,
    stats: {
      totalUsers,
      stores: {
        approved: approvedStores,
        pending: pendingStores,
        rejected: rejectedStores,
        total: approvedStores + pendingStores + rejectedStores,
      },
      totalOrders,
      gmv,
      todayOrders,
      last14Days,
      ordersByStatus,
    },
  });
});

// ==================== USERS MANAGEMENT ====================

const listUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filter = {};

  if (q && q.trim()) {
    const reg = new RegExp(q.trim(), 'i');
    filter.$or = [{ name: reg }, { email: reg }, { phone: reg }];
  }

  const users = await User.find(filter)
    .select('name email phone role isBlocked createdAt')
    .sort({ createdAt: -1 })
    .limit(100);

  res.status(200).json({
    success: true,
    users,
  });
});

const updateUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { isBlocked } = req.body;

  const targetUser = await User.findById(id);
  if (!targetUser) {
    return next(new AppError(404, 'NOT_FOUND', 'User not found'));
  }

  // Never allow blocking yourself or another admin
  if (String(targetUser._id) === String(req.user._id)) {
    return next(new AppError(400, 'CANNOT_BLOCK_SELF', 'You cannot block your own admin account'));
  }

  if (targetUser.role === 'admin' && isBlocked) {
    return next(new AppError(400, 'CANNOT_BLOCK_ADMIN', 'Administrators cannot be blocked'));
  }

  if (typeof isBlocked === 'boolean') {
    targetUser.isBlocked = isBlocked;
  }

  await targetUser.save();

  res.status(200).json({
    success: true,
    message: `User ${targetUser.isBlocked ? 'blocked' : 'unblocked'} successfully`,
    user: targetUser,
  });
});

// ==================== ORDERS MANAGEMENT ====================

const listAdminOrders = asyncHandler(async (req, res) => {
  const { status, store, from, to } = req.query;
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (store) {
    filter.store = store;
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const orders = await Order.find(filter)
    .populate('store', 'name slug phone address')
    .populate('customer', 'name phone email')
    .sort({ createdAt: -1 })
    .limit(100);

  res.status(200).json({
    success: true,
    orders,
  });
});

const getAdminOrderById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { $or: [{ _id: id }, { orderNo: id }] } : { orderNo: id };

  const order = await Order.findOne(query)
    .populate('store', 'name slug phone address owner')
    .populate('customer', 'name phone email')
    .populate('payment')
    .populate('statusHistory.by', 'name role email');

  if (!order) {
    return next(new AppError(404, 'NOT_FOUND', 'Order not found'));
  }

  res.status(200).json({
    success: true,
    order,
  });
});

const forceCancelOrder = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { note } = req.body;

  if (!note || !note.trim()) {
    return next(
      new AppError(
        400,
        'NOTE_REQUIRED',
        'A mandatory reason note is required for admin force-cancel',
      ),
    );
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { $or: [{ _id: id }, { orderNo: id }] } : { orderNo: id };

  const order = await Order.findOne(query);
  if (!order) {
    return next(new AppError(404, 'NOT_FOUND', 'Order not found'));
  }

  const updatedOrder = await orderService.transition(order._id, CANCELLED, {
    actor: req.user,
    role: 'admin',
    expectedStatus: order.status,
    note: `Admin force-cancel: ${note.trim()}`,
  });

  res.status(200).json({
    success: true,
    message: 'Order force-cancelled successfully',
    order: updatedOrder,
  });
});

// ==================== COMPLAINTS MANAGEMENT ====================

const listComplaints = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find()
    .populate('user', 'name email phone')
    .populate({
      path: 'order',
      select: 'orderNo store total status items createdAt',
      populate: { path: 'store', select: 'name phone' },
    })
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    complaints,
  });
});

const updateComplaint = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { adminReply, status } = req.body;

  const complaint = await Complaint.findById(id);
  if (!complaint) {
    return next(new AppError(404, 'NOT_FOUND', 'Complaint not found'));
  }

  if (adminReply !== undefined) {
    complaint.adminReply = adminReply.trim();
  }

  if (status && ['open', 'resolved'].includes(status)) {
    complaint.status = status;
  }

  await complaint.save();

  const populated = await Complaint.findById(complaint._id)
    .populate('user', 'name email phone')
    .populate({
      path: 'order',
      select: 'orderNo store total status',
      populate: { path: 'store', select: 'name' },
    });

  res.status(200).json({
    success: true,
    message: 'Complaint updated successfully',
    complaint: populated,
  });
});

// ==================== CSV REPORT EXPORT ====================

function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const exportReport = asyncHandler(async (req, res, next) => {
  const { type = 'orders' } = req.query;

  if (type === 'orders') {
    const orders = await Order.find()
      .populate('store', 'name')
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 });

    const headers = [
      'Order No',
      'Date',
      'Store Name',
      'Customer Name',
      'Customer Phone',
      'Fulfilment',
      'Subtotal (Rs)',
      'Delivery Fee (Rs)',
      'Total (Rs)',
      'Payment Method',
      'Payment Status',
      'Order Status',
    ];

    const rows = orders.map((o) => [
      escapeCsvField(o.orderNo),
      escapeCsvField(new Date(o.createdAt).toISOString()),
      escapeCsvField(o.store?.name || 'N/A'),
      escapeCsvField(o.customer?.name || 'N/A'),
      escapeCsvField(o.customer?.phone || 'N/A'),
      escapeCsvField(o.fulfilment),
      escapeCsvField((o.subtotal / 100).toFixed(2)),
      escapeCsvField((o.deliveryFee / 100).toFixed(2)),
      escapeCsvField((o.total / 100).toFixed(2)),
      escapeCsvField(o.paymentMethod),
      escapeCsvField(o.paymentStatus),
      escapeCsvField(o.status),
    ]);

    const csvString = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="locart-orders-report-${Date.now()}.csv"`,
    );
    return res.status(200).send(csvString);
  }

  if (type === 'stores') {
    const stores = await Store.find().populate('owner', 'name phone email').sort({ createdAt: -1 });

    const headers = [
      'Store Name',
      'Owner Name',
      'Owner Phone',
      'Address',
      'Pincode',
      'Status',
      'Is Open',
      'Delivery Radius (km)',
      'Delivery Fee (Rs)',
      'Min Order (Rs)',
      'Rating Avg',
      'Rating Count',
    ];

    const rows = stores.map((s) => [
      escapeCsvField(s.name),
      escapeCsvField(s.owner?.name || 'N/A'),
      escapeCsvField(s.owner?.phone || s.phone || 'N/A'),
      escapeCsvField(s.address),
      escapeCsvField(s.pincode),
      escapeCsvField(s.status),
      escapeCsvField(s.isOpen ? 'Yes' : 'No'),
      escapeCsvField(s.deliveryRadiusKm),
      escapeCsvField(((s.deliveryFee || 0) / 100).toFixed(2)),
      escapeCsvField(((s.minOrder || 0) / 100).toFixed(2)),
      escapeCsvField(s.ratingAvg || 0),
      escapeCsvField(s.ratingCount || 0),
    ]);

    const csvString = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="locart-stores-report-${Date.now()}.csv"`,
    );
    return res.status(200).send(csvString);
  }

  return next(new AppError(400, 'INVALID_REPORT_TYPE', 'Report type must be orders or stores'));
});

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listMasterProducts,
  createMasterProduct,
  updateMasterProduct,
  deleteMasterProduct,
  updateProductImage,
  listAdminStores,
  getAdminStoreById,
  updateAdminStoreStatus,
  getAdminStats,
  listUsers,
  updateUser,
  listAdminOrders,
  getAdminOrderById,
  forceCancelOrder,
  listComplaints,
  updateComplaint,
  exportReport,
};
