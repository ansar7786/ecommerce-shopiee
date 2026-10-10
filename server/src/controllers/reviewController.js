const { z } = require('zod');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Store = require('../models/Store');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { DELIVERED } = require('../constants/orderStatus');

const createReviewSchema = z.object({
  orderId: z.string().trim().min(1, 'Order ID is required'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z
    .string()
    .trim()
    .max(500, 'Comment cannot exceed 500 characters')
    .optional()
    .default(''),
});

// POST /api/reviews
const createReview = asyncHandler(async (req, res, next) => {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new AppError(400, 'VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', ')),
    );
  }

  const { orderId, rating, comment } = parsed.data;

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError(404, 'NOT_FOUND', 'Order not found'));
  }

  if (String(order.customer) !== String(req.user._id)) {
    return next(new AppError(403, 'FORBIDDEN', 'You can only review your own orders'));
  }

  if (order.status !== DELIVERED) {
    return next(
      new AppError(400, 'INVALID_STATUS', 'Reviews can only be submitted for delivered orders'),
    );
  }

  const existingReview = await Review.findOne({ order: order._id });
  if (existingReview) {
    return next(new AppError(400, 'ALREADY_REVIEWED', 'This order has already been reviewed'));
  }

  const review = await Review.create({
    user: req.user._id,
    store: order.store,
    order: order._id,
    rating,
    comment,
  });

  // Recompute Store ratingAvg and ratingCount
  const stats = await Review.aggregate([
    { $match: { store: order.store } },
    {
      $group: {
        _id: '$store',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Store.findByIdAndUpdate(order.store, {
      ratingAvg: Math.round(stats[0].avgRating * 10) / 10,
      ratingCount: stats[0].count,
    });
  }

  res.status(201).json({
    success: true,
    message: 'Thank you for your review!',
    review,
  });
});

// GET /api/reviews/order/:orderId
const getReviewByOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const review = await Review.findOne({ order: orderId });
  res.status(200).json({
    success: true,
    review: review || null,
  });
});

module.exports = {
  createReview,
  getReviewByOrder,
};
