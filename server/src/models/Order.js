const mongoose = require('mongoose');
const { ORDER_STATUSES, PLACED } = require('../constants/orderStatus');
const { PAYMENT_METHODS } = require('../constants/paymentMethod');
const { PAYMENT_STATUSES } = require('../constants/paymentStatus');

const orderItemSchema = new mongoose.Schema(
  {
    storeProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreProduct',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    nameTe: {
      type: String,
      default: '',
    },
    unit: {
      type: String,
      default: '1 pc',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    available: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    byRole: {
      type: String,
      enum: ['customer', 'store', 'admin', 'system'],
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: false },
);

const addressSnapshotSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Home' },
    line: { type: String, default: '' },
    pincode: { type: String, default: '' },
    landmark: { type: String, default: '' },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [(val) => val.length > 0, 'Order must contain at least one item'],
    },
    addressSnapshot: {
      type: addressSnapshotSchema,
      default: null,
    },
    fulfilment: {
      type: String,
      enum: ['delivery', 'pickup'],
      required: true,
    },
    deliveryNote: {
      type: String,
      default: '',
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: PLACED,
      required: true,
      index: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    rejectReason: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
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

// Indexes
orderSchema.index({ store: 1, status: 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ customer: 1, idempotencyKey: 1 }, { unique: true });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
