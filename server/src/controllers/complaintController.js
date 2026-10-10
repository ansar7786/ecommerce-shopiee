const { z } = require('zod');
const Complaint = require('../models/Complaint');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const createComplaintSchema = z.object({
  orderId: z.string().trim().min(1, 'Order ID is required'),
  message: z
    .string()
    .trim()
    .min(5, 'Message must be at least 5 characters')
    .max(1000, 'Message cannot exceed 1000 characters'),
});

// POST /api/complaints
const createComplaint = asyncHandler(async (req, res, next) => {
  const parsed = createComplaintSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(
      new AppError(400, 'VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', ')),
    );
  }

  const { orderId, message } = parsed.data;

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError(404, 'NOT_FOUND', 'Order not found'));
  }

  if (String(order.customer) !== String(req.user._id)) {
    return next(new AppError(403, 'FORBIDDEN', 'You can only report issues for your own orders'));
  }

  const complaint = await Complaint.create({
    user: req.user._id,
    order: order._id,
    message,
    status: 'open',
  });

  res.status(201).json({
    success: true,
    message: 'Complaint submitted successfully. Our team will review it.',
    complaint,
  });
});

// GET /api/complaints/my
const getMyComplaints = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate('order', 'orderNo status total createdAt');

  res.status(200).json({
    success: true,
    complaints,
  });
});

module.exports = {
  createComplaint,
  getMyComplaints,
};
