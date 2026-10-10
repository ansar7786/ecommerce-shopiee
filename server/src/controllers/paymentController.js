const { z } = require('zod');
const paymentService = require('../services/paymentService');
const { PAYMENT_METHODS, COD } = require('../constants/paymentMethod');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const initiatePaymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS).default(COD),
  storeId: z.string().optional(),
  items: z
    .array(
      z.object({
        storeProductId: z.string(),
        qty: z.number().int().positive().optional().default(1),
      }),
    )
    .optional(),
  fulfilment: z.enum(['delivery', 'pickup']).optional().default('delivery'),
  amount: z.number().int().positive().optional(),
  details: z.record(z.any()).optional().default({}),
});

// POST /api/payments/initiate
const initiatePayment = asyncHandler(async (req, res, next) => {
  const parsed = initiatePaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input'),
    );
  }

  const { method, storeId, items, fulfilment, amount, details } = parsed.data;

  const payment = await paymentService.initiate({
    method,
    userId: req.user._id,
    storeId,
    items,
    fulfilment,
    amount,
    details,
  });

  res.status(201).json({
    success: true,
    payment: {
      id: payment._id,
      _id: payment._id,
      method: payment.method,
      amount: payment.amount,
      status: payment.status,
    },
  });
});

// POST /api/payments/:id/confirm
const confirmPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { details = {}, brand, last4, upiId } = req.body;

  const mergedDetails = {
    ...details,
    brand: brand || details.brand,
    last4: last4 || details.last4,
    upiId: upiId || details.upiId,
  };

  const payment = await paymentService.confirm({
    paymentId: id,
    userId: req.user._id,
    details: mergedDetails,
  });

  res.status(200).json({
    success: true,
    payment: {
      id: payment._id,
      _id: payment._id,
      method: payment.method,
      amount: payment.amount,
      status: payment.status,
      last4: payment.last4,
      brand: payment.brand,
      upiId: payment.upiId,
    },
  });
});

// POST /api/payments/:id/cancel
const cancelPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payment = await paymentService.cancel({
    paymentId: id,
    userId: req.user._id,
  });

  res.status(200).json({
    success: true,
    payment: {
      id: payment._id,
      _id: payment._id,
      method: payment.method,
      amount: payment.amount,
      status: payment.status,
    },
  });
});

module.exports = {
  initiatePayment,
  confirmPayment,
  cancelPayment,
};
