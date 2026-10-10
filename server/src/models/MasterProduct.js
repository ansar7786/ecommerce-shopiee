const mongoose = require('mongoose');

const masterProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameTe: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    mrp: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer paise value',
      },
      min: 1,
    },
    image: {
      type: String,
      default: null,
    },
    barcode: {
      type: String,
      trim: true,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
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

masterProductSchema.index({ name: 'text', nameTe: 'text', brand: 'text' });
masterProductSchema.index({ name: 1, unit: 1 });

const MasterProduct = mongoose.model('MasterProduct', masterProductSchema);

module.exports = MasterProduct;
