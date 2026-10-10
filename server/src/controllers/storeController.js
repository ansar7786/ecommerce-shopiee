const mongoose = require('mongoose');
const { z } = require('zod');
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const Order = require('../models/Order');
const geoService = require('../services/geoService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { emitStoreStatus, emitStoreRegistered } = require('../sockets');

// Generate URL friendly slug from store name
const generateSlug = async (name) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  let slug = base || 'kirana-store';
  let counter = 1;

  while (await Store.findOne({ slug })) {
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    slug = `${base}-${randomSuffix || counter}`;
    counter++;
  }

  return slug;
};

// Zod schema for store registration
const registerStoreSchema = z.object({
  name: z.string().min(2, 'Store name must be at least 2 characters').trim(),
  phone: z.string().min(10, 'Phone must be at least 10 digits').trim(),
  address: z.string().min(3, 'Address is required').trim(),
  pincode: z.string().regex(/^\d{6}$/, 'PIN code must be a 6-digit number'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timings: z
    .object({
      open: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Open time must be in HH:mm format'),
      close: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Close time must be in HH:mm format'),
    })
    .optional()
    .default({ open: '07:00', close: '21:00' }),
  deliveryRadiusKm: z.number().int().min(1).max(5).default(3),
  deliveryFee: z.number().int().min(0).default(2000), // paise
  freeDeliveryAbove: z.number().int().min(0).default(29900), // paise
  minOrder: z.number().int().min(0).default(9900), // paise
  supportsDelivery: z.boolean().optional().default(true),
  supportsPickup: z.boolean().optional().default(true),
  gstNumber: z.string().trim().optional().default(''),
  fssaiNumber: z.string().trim().optional().default(''),
  photo: z.string().nullable().optional(),
});

// POST /api/stores/register
const registerStore = asyncHandler(async (req, res, next) => {
  const parsed = registerStoreSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input'),
    );
  }

  const existingStore = await Store.findOne({ owner: req.user._id });
  if (existingStore) {
    if (existingStore.status === 'rejected') {
      // Allow re-submitting rejected store
      Object.assign(existingStore, {
        ...parsed.data,
        location: {
          type: 'Point',
          coordinates: [parsed.data.longitude, parsed.data.latitude],
        },
        status: 'pending',
        rejectionReason: '',
      });
      await existingStore.save();
      emitStoreRegistered(existingStore);
      return res.status(200).json({
        success: true,
        message: 'Store application re-submitted successfully',
        store: existingStore,
      });
    }

    return next(
      new AppError(
        400,
        'STORE_EXISTS',
        `You already have a store application with status: ${existingStore.status}`,
      ),
    );
  }

  const slug = await generateSlug(parsed.data.name);

  const store = await Store.create({
    owner: req.user._id,
    name: parsed.data.name,
    slug,
    phone: parsed.data.phone,
    address: parsed.data.address,
    pincode: parsed.data.pincode,
    location: {
      type: 'Point',
      coordinates: [parsed.data.longitude, parsed.data.latitude],
    },
    timings: parsed.data.timings,
    deliveryRadiusKm: parsed.data.deliveryRadiusKm,
    deliveryFee: parsed.data.deliveryFee,
    freeDeliveryAbove: parsed.data.freeDeliveryAbove,
    minOrder: parsed.data.minOrder,
    supportsDelivery: parsed.data.supportsDelivery,
    supportsPickup: parsed.data.supportsPickup,
    gstNumber: parsed.data.gstNumber || '',
    fssaiNumber: parsed.data.fssaiNumber || '',
    photo: parsed.data.photo || null,
    status: 'pending',
    rejectionReason: '',
  });

  emitStoreRegistered(store);

  res.status(201).json({
    success: true,
    message: 'Store registered successfully and submitted for approval',
    store,
  });
});

// GET /api/stores/me
const getMyStore = asyncHandler(async (req, res) => {
  const store = await Store.findOne({ owner: req.user._id }).populate(
    'owner',
    'name email phone photo isBlocked',
  );

  let productCount = 0;
  if (store) {
    productCount = await StoreProduct.countDocuments({ store: store._id, isActive: true });
  }

  res.status(200).json({
    success: true,
    store: store ? { ...store.toObject(), productCount } : null,
  });
});

// PATCH /api/stores/me
const updateMyStore = asyncHandler(async (req, res, next) => {
  const store = await Store.findOne({ owner: req.user._id });
  if (!store) {
    return next(new AppError(404, 'NOT_FOUND', 'No store found for your account'));
  }

  // Schema for updating store
  const updateSchema = registerStoreSchema.partial();
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input'),
    );
  }

  const updates = { ...parsed.data };

  // Handle location coordinates update if lat/lng passed
  if (updates.latitude !== undefined && updates.longitude !== undefined) {
    updates.location = {
      type: 'Point',
      coordinates: [updates.longitude, updates.latitude],
    };
    delete updates.latitude;
    delete updates.longitude;
  }

  // If rejected, updating resubmits the application for admin approval
  if (store.status === 'rejected') {
    updates.status = 'pending';
    updates.rejectionReason = '';
  }

  // If name changed, optionally regenerate slug if needed
  if (updates.name && updates.name !== store.name) {
    updates.slug = await generateSlug(updates.name);
  }

  Object.assign(store, updates);
  await store.save();

  if (updates.status === 'pending') {
    emitStoreRegistered(store);
  }

  res.status(200).json({
    success: true,
    message: 'Store updated successfully',
    store,
  });
});

// POST /api/stores/me/photo
const uploadStorePhoto = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError(400, 'NO_FILE', 'Please upload a photo image'));
  }

  const store = await Store.findOne({ owner: req.user._id });
  if (!store) {
    return next(new AppError(404, 'NOT_FOUND', 'Store not found'));
  }

  const photoPath = `/uploads/stores/${req.file.filename}`;
  store.photo = photoPath;
  await store.save();

  res.status(200).json({
    success: true,
    photo: photoPath,
    store,
  });
});

// GET /api/stores/nearby?lat&lng
const getNearby = asyncHandler(async (req, res, next) => {
  const { lat, lng } = req.query;

  if (lat === undefined || lng === undefined) {
    return next(
      new AppError(
        400,
        'MISSING_COORDINATES',
        'Latitude and longitude are required query parameters',
      ),
    );
  }

  const stores = await geoService.getNearbyStores(lat, lng);

  res.status(200).json({
    success: true,
    count: stores.length,
    stores,
  });
});

// GET /api/stores/:id (public fields)
const getStoreById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { $or: [{ _id: id }, { slug: id }] } : { slug: id };

  const store = await Store.findOne({ ...query, status: 'approved' }).populate(
    'owner',
    'isBlocked',
  );
  if (!store || store.owner?.isBlocked) {
    return next(new AppError(404, 'NOT_FOUND', 'Store not found or not approved'));
  }

  const { isOpenNow, opensAt } = geoService.checkStoreOpenStatus(store);

  res.status(200).json({
    success: true,
    store: {
      id: store._id,
      _id: store._id,
      name: store.name,
      slug: store.slug,
      phone: store.phone,
      photo: store.photo,
      address: store.address,
      pincode: store.pincode,
      location: store.location,
      isOpen: store.isOpen,
      timings: store.timings,
      deliveryRadiusKm: store.deliveryRadiusKm,
      deliveryFee: store.deliveryFee,
      freeDeliveryAbove: store.freeDeliveryAbove,
      minOrder: store.minOrder,
      supportsDelivery: store.supportsDelivery,
      supportsPickup: store.supportsPickup,
      ratingAvg: store.ratingAvg || 4.5,
      ratingCount: store.ratingCount || 0,
      isOpenNow,
      opensAt,
    },
  });
});

// GET /api/stores/:id/products?category&q
const getStoreProductsPublic = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { category, q } = req.query;

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const storeQuery = isObjectId ? { $or: [{ _id: id }, { slug: id }] } : { slug: id };

  const store = await Store.findOne({ ...storeQuery, status: 'approved' }).populate(
    'owner',
    'isBlocked',
  );
  if (!store || store.owner?.isBlocked) {
    return next(new AppError(404, 'NOT_FOUND', 'Store not found or not approved'));
  }

  // Only isActive products from this approved store
  const query = {
    store: store._id,
    isActive: true,
  };

  const storeProducts = await StoreProduct.find(query)
    .populate({
      path: 'masterProduct',
      populate: { path: 'category', select: 'name nameTe icon sortOrder' },
    })
    .sort({ inStock: -1, updatedAt: -1 });

  // Map into clean customer-facing list
  let products = storeProducts.map((sp) => {
    const isMaster = Boolean(sp.masterProduct);
    const master = sp.masterProduct;
    return {
      _id: sp._id,
      storeProductId: sp._id,
      masterProductId: master?._id || null,
      name: isMaster ? master.name : sp.customName,
      nameTe: isMaster ? master.nameTe || '' : '',
      brand: isMaster ? master.brand || '' : '',
      unit: isMaster ? master.unit || '1 pc' : '1 pc',
      price: sp.price,
      mrp: sp.mrp,
      savings: Math.max(0, sp.mrp - sp.price),
      image: sp.customImage || master?.image || null,
      category: master?.category || null,
      inStock: sp.inStock,
      isActive: sp.isActive,
    };
  });

  // Filter by category if supplied
  if (category && category !== 'all' && mongoose.Types.ObjectId.isValid(category)) {
    products = products.filter((p) => p.category && String(p.category._id) === String(category));
  }

  // Filter by search query if supplied
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    products = products.filter((p) => {
      const matchName = p.name && p.name.toLowerCase().includes(term);
      const matchNameTe = p.nameTe && p.nameTe.toLowerCase().includes(term);
      const matchBrand = p.brand && p.brand.toLowerCase().includes(term);
      return matchName || matchNameTe || matchBrand;
    });
  }

  res.status(200).json({
    success: true,
    count: products.length,
    products,
  });
});

// PATCH /api/stores/me/open
const toggleStoreOpen = asyncHandler(async (req, res, next) => {
  const store = await Store.findOne({ owner: req.user._id });
  if (!store) {
    return next(new AppError(404, 'NOT_FOUND', 'No store found for your account'));
  }

  const { isOpen } = req.body;
  store.isOpen = typeof isOpen === 'boolean' ? isOpen : !store.isOpen;
  await store.save();

  // Real-time socket event emission
  emitStoreStatus(store._id, store.isOpen);

  res.status(200).json({
    success: true,
    message: `Store is now ${store.isOpen ? 'open' : 'closed'}`,
    store,
  });
});

// GET /api/store/analytics
const getStoreAnalytics = asyncHandler(async (req, res, next) => {
  const store = await Store.findOne({ owner: req.user._id });
  if (!store) {
    return next(new AppError(404, 'NOT_FOUND', 'No store found for your account'));
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);

  // 1. Today's orders count & revenue (revenue from DELIVERED only)
  const todayOrders = await Order.countDocuments({
    store: store._id,
    createdAt: { $gte: startOfToday },
  });

  const todayRevenueAgg = await Order.aggregate([
    {
      $match: {
        store: store._id,
        status: 'DELIVERED',
        createdAt: { $gte: startOfToday },
      },
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$total' },
      },
    },
  ]);
  const todayRevenue = todayRevenueAgg[0]?.revenue || 0;

  // 2. This week's revenue (DELIVERED only, past 7 days)
  const thisWeekRevenueAgg = await Order.aggregate([
    {
      $match: {
        store: store._id,
        status: 'DELIVERED',
        createdAt: { $gte: sevenDaysAgo },
      },
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$total' },
      },
    },
  ]);
  const thisWeekRevenue = thisWeekRevenueAgg[0]?.revenue || 0;

  // 3. Rejected & Cancelled count
  const rejectedCancelledCount = await Order.countDocuments({
    store: store._id,
    status: { $in: ['REJECTED', 'CANCELLED', 'EXPIRED'] },
  });

  // 4. Last 7 days breakdown (date, orders, revenue)
  const ordersLast7Agg = await Order.aggregate([
    {
      $match: {
        store: store._id,
        createdAt: { $gte: sevenDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        orders: { $sum: 1 },
        revenue: {
          $sum: {
            $cond: [{ $eq: ['$status', 'DELIVERED'] }, '$total', 0],
          },
        },
      },
    },
  ]);

  const aggMap = new Map(ordersLast7Agg.map((item) => [item._id, item]));
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const match = aggMap.get(dateStr);
    last7Days.push({
      date: dateStr,
      orders: match?.orders || 0,
      revenue: match?.revenue || 0,
    });
  }

  // 5. Top 5 items (by total qty sold in DELIVERED orders)
  const topItemsAgg = await Order.aggregate([
    {
      $match: {
        store: store._id,
        status: 'DELIVERED',
      },
    },
    { $unwind: '$items' },
    {
      $match: {
        'items.available': { $ne: false },
      },
    },
    {
      $group: {
        _id: '$items.name',
        name: { $first: '$items.name' },
        nameTe: { $first: '$items.nameTe' },
        qty: { $sum: '$items.qty' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
      },
    },
    { $sort: { qty: -1 } },
    { $limit: 5 },
  ]);

  res.status(200).json({
    success: true,
    analytics: {
      todayOrders,
      todayRevenue,
      thisWeekRevenue,
      rejectedCancelledCount,
      last7Days,
      topItems: topItemsAgg,
    },
  });
});

module.exports = {
  registerStore,
  getMyStore,
  updateMyStore,
  uploadStorePhoto,
  getNearby,
  getStoreById,
  getStoreProductsPublic,
  toggleStoreOpen,
  getStoreAnalytics,
};
