const mongoose = require('mongoose');
const { z } = require('zod');
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const pricingService = require('../services/pricingService');
const geoService = require('../services/geoService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const validateCartSchema = z.object({
  storeId: z.string().trim().min(1, 'Store ID is required'),
  items: z
    .array(
      z.object({
        storeProductId: z.string().trim().min(1, 'Product ID is required'),
        qty: z
          .number({ invalid_type_error: 'Quantity must be a number' })
          .int('Quantity must be an integer')
          .min(1, 'Quantity must be at least 1')
          .max(10, 'Maximum 10 items per product allowed'),
        clientPrice: z.number().optional(),
        price: z.number().optional(),
      }),
    )
    .default([]),
  fulfilment: z.enum(['delivery', 'pickup']).default('delivery'),
});

// POST /api/cart/validate
const validateCart = asyncHandler(async (req, res, next) => {
  const parsed = validateCartSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const { storeId, items, fulfilment } = parsed.data;

  // 1. Find approved store
  const isObjectId = mongoose.Types.ObjectId.isValid(storeId);
  const storeQuery = isObjectId
    ? { $or: [{ _id: storeId }, { slug: storeId }] }
    : { slug: storeId };

  const store = await Store.findOne({ ...storeQuery, status: 'approved' });
  if (!store) {
    return next(new AppError(404, 'STORE_NOT_FOUND', 'Store not found or no longer approved'));
  }

  const { isOpenNow, opensAt } = geoService.checkStoreOpenStatus(store);

  // 2. Fetch fresh StoreProduct documents from database
  const productIds = items
    .map((i) => i.storeProductId)
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  const storeProducts = await StoreProduct.find({
    _id: { $in: productIds },
    store: store._id,
  }).populate('masterProduct');

  const productMap = new Map(storeProducts.map((p) => [String(p._id), p]));

  // 3. Reconcile each line item
  const validatedLines = [];
  const billableItems = [];

  for (const item of items) {
    const sp = productMap.get(item.storeProductId);

    if (!sp) {
      validatedLines.push({
        storeProductId: item.storeProductId,
        qty: item.qty,
        currentPrice: 0,
        currentMrp: 0,
        priceChanged: false,
        inStock: false,
        available: false,
        name: 'Item Unavailable',
        nameTe: '',
        unit: '',
        image: null,
      });
      continue;
    }

    const isMaster = Boolean(sp.masterProduct);
    const master = sp.masterProduct;
    const name = isMaster ? master.name : sp.customName;
    const nameTe = isMaster ? master.nameTe || '' : '';
    const unit = isMaster ? master.unit || '1 pc' : '1 pc';
    const image = sp.customImage || master?.image || null;

    const currentPrice = sp.price;
    const currentMrp = sp.mrp;
    const inStock = Boolean(sp.inStock && sp.isActive);
    const available = inStock;

    // Check if client price differs from fresh DB price
    const incomingPrice = item.clientPrice !== undefined ? item.clientPrice : item.price;
    const priceChanged =
      incomingPrice !== undefined &&
      typeof incomingPrice === 'number' &&
      incomingPrice !== currentPrice;

    validatedLines.push({
      storeProductId: sp._id,
      name,
      nameTe,
      unit,
      image,
      qty: item.qty,
      currentPrice,
      currentMrp,
      clientPrice: item.clientPrice,
      priceChanged,
      inStock,
      available,
    });

    if (available) {
      billableItems.push({
        price: currentPrice,
        mrp: currentMrp,
        qty: item.qty,
      });
    }
  }

  // 4. Compute authoritative bill
  const bill = pricingService.computeBill(store, billableItems, fulfilment);

  // 5. Compute status flags
  const subtotal = bill.subtotal;
  const belowMinOrder = subtotal > 0 && subtotal < store.minOrder;
  const minOrderShort = belowMinOrder ? store.minOrder - subtotal : 0;

  const freeDeliveryAbove = store.freeDeliveryAbove || 0;
  const freeDeliveryShort = Math.max(0, freeDeliveryAbove - subtotal);
  const nearFreeDelivery =
    fulfilment === 'delivery' &&
    freeDeliveryAbove > 0 &&
    subtotal > 0 &&
    subtotal < freeDeliveryAbove &&
    freeDeliveryShort <= 10000; // within ₹100 of free delivery threshold

  const hasOutOfStock = validatedLines.some((l) => !l.inStock || !l.available);
  const hasPriceChanges = validatedLines.some((l) => l.priceChanged);

  res.status(200).json({
    success: true,
    store: {
      id: store._id,
      name: store.name,
      slug: store.slug,
      isOpenNow,
      opensAt,
      minOrder: store.minOrder,
      freeDeliveryAbove: store.freeDeliveryAbove,
      deliveryFee: store.deliveryFee,
      supportsDelivery: store.supportsDelivery,
      supportsPickup: store.supportsPickup,
    },
    storeOpen: isOpenNow,
    belowMinOrder,
    minOrderShort,
    nearFreeDelivery,
    freeDeliveryShort,
    hasOutOfStock,
    hasPriceChanges,
    items: validatedLines,
    bill,
  });
});

module.exports = {
  validateCart,
};
