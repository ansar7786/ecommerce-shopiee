const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../constants/paymentMethod');
const { PAYMENT_STATUSES, PENDING } = require('../constants/paymentStatus');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: PENDING,
      index: true,
    },
    last4: {
      type: String,
      default: null,
    },
    brand: {
      type: String,
      default: null,
    },
    upiId: {
      type: String,
      default: null,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
