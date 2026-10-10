const { z } = require('zod');
const mongoose = require('mongoose');
const MasterProduct = require('../models/MasterProduct');
const StoreProduct = require('../models/StoreProduct');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ==================== 1. LIST MASTER PRODUCTS FOR STORE ====================
// GET /api/master-products?q&category&page&limit
const listMasterProductsForStore = asyncHandler(async (req, res) => {
  const { q, category, page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const filter = { isActive: true };

  if (category && mongoose.Types.ObjectId.isValid(category)) {
    filter.category = category;
  }

  if (q && q.trim()) {
    const regex = { $regex: q.trim(), $options: 'i' };
    filter.$or = [{ name: regex }, { nameTe: regex }, { brand: regex }];
  }

  // Get active master products
  const [products, total] = await Promise.all([
    MasterProduct.find(filter)
      .populate('category', 'name nameTe icon')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum),
    MasterProduct.countDocuments(filter),
  ]);

  // Find all active store products already added to this store
  const alreadyAddedIds = await StoreProduct.distinct('masterProduct', {
    store: req.store._id,
    isActive: true,
    masterProduct: { $ne: null },
  });

  const addedSet = new Set(alreadyAddedIds.map(String));

  const enrichedProducts = products.map((p) => {
    const doc = p.toObject();
    return {
      ...doc,
      alreadyAdded: addedSet.has(String(p._id)),
    };
  });

  res.status(200).json({
    success: true,
    products: enrichedProducts,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

// ==================== 2. BULK ADD STORE PRODUCTS ====================
// POST /api/store-products/bulk
const bulkAddSchema = z.object({
  items: z
    .array(
      z.object({
        masterProductId: z
          .string()
          .refine((val) => mongoose.Types.ObjectId.isValid(val), 'Invalid master product ID'),
        price: z.number({ invalid_type_error: 'Price must be a number' }),
      }),
    )
    .min(1, 'At least one item is required'),
});

const bulkAddStoreProducts = asyncHandler(async (req, res, next) => {
  const parsed = bulkAddSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input'),
    );
  }

  const { items } = parsed.data;

  // 1. Fetch all referenced master products to copy MRP and validate price
  const masterIds = items.map((i) => i.masterProductId);
  const masterProducts = await MasterProduct.find({ _id: { $in: masterIds }, isActive: true });
  const masterMap = new Map(masterProducts.map((p) => [String(p._id), p]));

  // 2. Validate price against MRP for each item
  for (const item of items) {
    const master = masterMap.get(item.masterProductId);
    if (!master) {
      return next(
        new AppError(404, 'NOT_FOUND', `Master product ${item.masterProductId} not found`),
      );
    }

    if (!Number.isInteger(item.price) || item.price <= 0) {
      return next(new AppError(422, 'INVALID_PRICE', 'Price must be a positive integer in paise'));
    }

    // Critical rule: Price above MRP must be rejected with 422
    if (item.price > master.mrp) {
      return next(
        new AppError(
          422,
          'PRICE_EXCEEDS_MRP',
          `Price for "${master.name}" (₹${item.price / 100}) cannot exceed MRP (₹${master.mrp / 100})`,
        ),
      );
    }
  }

  // 3. Find existing store products to skip duplicates
  const existingStoreProducts = await StoreProduct.find({
    store: req.store._id,
    masterProduct: { $in: masterIds },
  });
  const existingMap = new Map(existingStoreProducts.map((p) => [String(p.masterProduct), p]));

  const createdDocs = [];

  for (const item of items) {
    const master = masterMap.get(item.masterProductId);
    const existing = existingMap.get(item.masterProductId);

    if (existing) {
      // If was previously deactivated, re-activate with updated price
      existing.price = item.price;
      existing.mrp = master.mrp;
      existing.inStock = true;
      existing.isActive = true;
      await existing.save();
      createdDocs.push(existing);
    } else {
      // Create new store product
      const created = await StoreProduct.create({
        store: req.store._id,
        masterProduct: master._id,
        price: item.price,
        mrp: master.mrp,
        inStock: true,
        isActive: true,
      });
      createdDocs.push(created);
    }
  }

  res.status(201).json({
    success: true,
    message: `Added ${createdDocs.length} products to store catalog`,
    count: createdDocs.length,
    products: createdDocs,
  });
});

// ==================== 3. ADD CUSTOM STORE PRODUCT ====================
// POST /api/store-products/custom
const customProductSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required').max(200),
  price: z
    .number({ invalid_type_error: 'Price must be a number' })
    .int('Price must be in paise')
    .positive('Price must be greater than 0'),
  photo: z.string().nullable().optional(),
});

const addCustomStoreProduct = asyncHandler(async (req, res, next) => {
  const parsed = customProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input'),
    );
  }

  const { name, price, photo } = parsed.data;

  // Custom product rule: mrp = price
  const storeProduct = await StoreProduct.create({
    store: req.store._id,
    masterProduct: null,
    customName: name,
    customImage: photo || null,
    price,
    mrp: price,
    inStock: true,
    isActive: true,
  });

  res.status(201).json({
    success: true,
    message: 'Custom product added successfully',
    product: storeProduct,
  });
});

// ==================== 4. GET STORE'S OWN PRODUCTS ====================
// GET /api/store-products
const getMyStoreProducts = asyncHandler(async (req, res) => {
  const { q, category, inStock } = req.query;

  const query = {
    store: req.store._id,
    isActive: true,
  };

  if (inStock === 'true') query.inStock = true;
  if (inStock === 'false') query.inStock = false;

  let storeProducts = await StoreProduct.find(query)
    .populate({
      path: 'masterProduct',
      populate: { path: 'category', select: 'name nameTe icon' },
    })
    .sort({ inStock: -1, updatedAt: -1 });

  // Filter in-memory for category and text query if supplied
  if (category && mongoose.Types.ObjectId.isValid(category)) {
    storeProducts = storeProducts.filter(
      (sp) => sp.masterProduct && String(sp.masterProduct.category?._id) === String(category),
    );
  }

  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    storeProducts = storeProducts.filter((sp) => {
      if (sp.customName && sp.customName.toLowerCase().includes(term)) return true;
      if (sp.masterProduct) {
        if (sp.masterProduct.name && sp.masterProduct.name.toLowerCase().includes(term))
          return true;
        if (sp.masterProduct.nameTe && sp.masterProduct.nameTe.toLowerCase().includes(term))
          return true;
        if (sp.masterProduct.brand && sp.masterProduct.brand.toLowerCase().includes(term))
          return true;
      }
      return false;
    });
  }

  const totalCount = await StoreProduct.countDocuments({ store: req.store._id, isActive: true });
  const inStockCount = await StoreProduct.countDocuments({
    store: req.store._id,
    isActive: true,
    inStock: true,
  });
  const outOfStockCount = totalCount - inStockCount;

  res.status(200).json({
    success: true,
    products: storeProducts,
    totalCount,
    inStockCount,
    outOfStockCount,
  });
});

// ==================== 5. UPDATE STORE PRODUCT ====================
// PATCH /api/store-products/:id
const updateStoreProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Must verify product belongs to caller's store (404 otherwise)
  const product = await StoreProduct.findOne({
    _id: id,
    store: req.store._id,
    isActive: true,
  }).populate({
    path: 'masterProduct',
    populate: { path: 'category', select: 'name nameTe icon' },
  });

  if (!product) {
    return next(new AppError(404, 'NOT_FOUND', 'Product not found in your store'));
  }

  const { price, inStock } = req.body;

  if (price !== undefined) {
    if (!Number.isInteger(price) || price <= 0) {
      return next(new AppError(422, 'INVALID_PRICE', 'Price must be a positive integer in paise'));
    }

    if (price > product.mrp) {
      return next(
        new AppError(
          422,
          'PRICE_EXCEEDS_MRP',
          `Price (₹${price / 100}) cannot exceed MRP (₹${product.mrp / 100})`,
        ),
      );
    }
    product.price = price;
  }

  if (inStock !== undefined) {
    product.inStock = Boolean(inStock);
  }

  await product.save();

  res.status(200).json({
    success: true,
    message: 'Store product updated successfully',
    product,
  });
});

// ==================== 6. REMOVE STORE PRODUCT ====================
// DELETE /api/store-products/:id
const deleteStoreProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Must verify product belongs to caller's store (404 otherwise)
  const product = await StoreProduct.findOne({
    _id: id,
    store: req.store._id,
    isActive: true,
  });

  if (!product) {
    return next(new AppError(404, 'NOT_FOUND', 'Product not found in your store'));
  }

  // Soft delete: set isActive to false
  product.isActive = false;
  await product.save();

  res.status(200).json({
    success: true,
    message: 'Product removed from store catalogue',
  });
});

// ==================== 7. MARK WHOLE CATEGORY OUT OF STOCK ====================
// PATCH /api/store-products/category/:categoryId/out-of-stock
const markCategoryOutOfStock = asyncHandler(async (req, res, next) => {
  const { categoryId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return next(new AppError(400, 'INVALID_ID', 'Invalid category ID'));
  }

  // Find all master products belonging to this category
  const masterProducts = await MasterProduct.find({ category: categoryId }).select('_id');
  const masterIds = masterProducts.map((p) => p._id);

  const updateResult = await StoreProduct.updateMany(
    {
      store: req.store._id,
      masterProduct: { $in: masterIds },
      isActive: true,
    },
    {
      inStock: false,
    },
  );

  res.status(200).json({
    success: true,
    message: `Marked ${updateResult.modifiedCount} products out of stock`,
    updatedCount: updateResult.modifiedCount,
  });
});

module.exports = {
  listMasterProductsForStore,
  bulkAddStoreProducts,
  addCustomStoreProduct,
  getMyStoreProducts,
  updateStoreProduct,
  deleteStoreProduct,
  markCategoryOutOfStock,
};
