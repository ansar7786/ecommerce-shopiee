const mongoose = require('mongoose');

const storeProductSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    masterProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterProduct',
      default: null,
    },
    customName: {
      type: String,
      trim: true,
      default: null,
    },
    customImage: {
      type: String,
      default: null,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer paise value',
      },
    },
    mrp: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer paise value',
      },
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Partial unique index: only enforce uniqueness when masterProduct is an ObjectId
storeProductSchema.index(
  { store: 1, masterProduct: 1 },
  {
    unique: true,
    partialFilterExpression: {
      masterProduct: { $exists: true, $type: 'objectId' },
    },
  },
);

// Index for active store catalog queries
storeProductSchema.index({ store: 1, isActive: 1 });

const StoreProduct = mongoose.model('StoreProduct', storeProductSchema);

module.exports = StoreProduct;
