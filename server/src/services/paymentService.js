const Payment = require('../models/Payment');
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const pricingService = require('./pricingService');
const { COD, CARD, UPI } = require('../constants/paymentMethod');
const { SUCCESS, PENDING, FAILED, CANCELLED } = require('../constants/paymentStatus');
const AppError = require('../utils/AppError');

/**
 * Payment Service (mocked gateway).
 * Server is the single source of truth for all payment records.
 * COD: SUCCESS immediately; not allowed when total > 200,000 paise (₹2,000).
 * CARD: client sends only brand and last4 (never the number or CVV);
 *       last4 "0002" => FAILED ("Payment declined by bank"), else SUCCESS.
 * UPI: client sends upiId; format ^[\w.\-]{2,}@[a-zA-Z]{2,}$; "fail" in id => FAILED, else SUCCESS.
 * /cancel endpoint => CANCELLED.
 */

async function initiate({ method = COD, userId, storeId, items, fulfilment = 'delivery', amount }) {
  if (!userId) {
    throw new AppError(400, 'PAYMENT_ERROR', 'User ID is required to initiate payment');
  }

  // 1. Authoritative amount determination
  let authoritativeTotal = 0;

  if (storeId && Array.isArray(items) && items.length > 0) {
    const store = await Store.findById(storeId);
    if (!store) {
      throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found');
    }

    const storeProductIds = items.map((i) => i.storeProductId);
    const storeProducts = await StoreProduct.find({
      _id: { $in: storeProductIds },
      store: store._id,
      isActive: true,
    });

    const spMap = new Map(storeProducts.map((sp) => [String(sp._id), sp]));
    const billableItems = [];

    for (const item of items) {
      const sp = spMap.get(String(item.storeProductId));
      if (!sp) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Item not found in store catalogue');
      }
      const qty = Math.max(1, Math.min(10, Number(item.qty) || 1));
      billableItems.push({
        price: sp.price,
        mrp: sp.mrp,
        qty,
      });
    }

    const bill = pricingService.computeBill(store, billableItems, fulfilment);
    authoritativeTotal = bill.total;
  } else if (typeof amount === 'number' && amount > 0) {
    authoritativeTotal = Math.round(amount);
  } else {
    throw new AppError(
      400,
      'PAYMENT_ERROR',
      'Valid store and items or payment amount in paise is required',
    );
  }

  // 2. Process based on method
  if (method === COD) {
    if (authoritativeTotal > 200000) {
      throw new AppError(
        400,
        'COD_LIMIT_EXCEEDED',
        'Cash on Delivery is not allowed for orders above ₹2,000',
      );
    }

    const payment = await Payment.create({
      user: userId,
      method: COD,
      amount: authoritativeTotal,
      status: SUCCESS,
    });
    return payment;
  }

  if (method === CARD) {
    const payment = await Payment.create({
      user: userId,
      method: CARD,
      amount: authoritativeTotal,
      status: PENDING,
    });
    return payment;
  }

  if (method === UPI) {
    const payment = await Payment.create({
      user: userId,
      method: UPI,
      amount: authoritativeTotal,
      status: PENDING,
    });
    return payment;
  }

  throw new AppError(400, 'INVALID_PAYMENT_METHOD', `Unsupported payment method: ${method}`);
}

async function confirm({ paymentId, userId, details = {} }) {
  if (!paymentId || !userId) {
    throw new AppError(400, 'BAD_REQUEST', 'Payment ID and User ID are required');
  }

  const payment = await Payment.findOne({ _id: paymentId, user: userId });
  if (!payment) {
    throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment record not found');
  }

  if (payment.status === SUCCESS) {
    return payment;
  }

  if (payment.status === CANCELLED) {
    throw new AppError(400, 'PAYMENT_CANCELLED', 'Payment was cancelled');
  }

  if (payment.method === CARD) {
    const { brand = 'Card', last4 = '4242' } = details;
    // Security check: NEVER store or log card number or CVV
    const cleanLast4 = String(last4).slice(-4);

    if (cleanLast4 === '0002') {
      payment.status = FAILED;
      payment.last4 = cleanLast4;
      payment.brand = String(brand);
      await payment.save();
      throw new AppError(400, 'PAYMENT_FAILED', 'Payment declined by bank');
    }

    payment.status = SUCCESS;
    payment.last4 = cleanLast4;
    payment.brand = String(brand);
    await payment.save();
    return payment;
  }

  if (payment.method === UPI) {
    const { upiId } = details;
    if (!upiId || typeof upiId !== 'string') {
      throw new AppError(400, 'INVALID_UPI_ID', 'UPI ID is required');
    }

    const trimmedUpi = upiId.trim();
    const upiRegex = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;
    if (!upiRegex.test(trimmedUpi)) {
      throw new AppError(400, 'INVALID_UPI_ID', 'Invalid UPI ID format');
    }

    if (trimmedUpi.toLowerCase().includes('fail')) {
      payment.status = FAILED;
      payment.upiId = trimmedUpi;
      await payment.save();
      throw new AppError(400, 'PAYMENT_FAILED', 'UPI payment failed');
    }

    payment.status = SUCCESS;
    payment.upiId = trimmedUpi;
    await payment.save();
    return payment;
  }

  if (payment.method === COD) {
    payment.status = SUCCESS;
    await payment.save();
    return payment;
  }

  throw new AppError(
    400,
    'INVALID_PAYMENT_METHOD',
    `Unsupported payment method: ${payment.method}`,
  );
}

async function cancel({ paymentId, userId }) {
  if (!paymentId || !userId) {
    throw new AppError(400, 'BAD_REQUEST', 'Payment ID and User ID are required');
  }

  const payment = await Payment.findOne({ _id: paymentId, user: userId });
  if (!payment) {
    throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment record not found');
  }

  if (payment.status === PENDING) {
    payment.status = CANCELLED;
    await payment.save();
  }

  return payment;
}

module.exports = {
  initiate,
  confirm,
  cancel,
};
