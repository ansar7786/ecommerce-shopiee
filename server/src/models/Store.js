const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    photo: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    timings: {
      open: {
        type: String,
        default: '07:00',
        trim: true,
      },
      close: {
        type: String,
        default: '21:00',
        trim: true,
      },
    },
    deliveryRadiusKm: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 3,
    },
    deliveryFee: {
      type: Number,
      required: true,
      min: 0,
      default: 2000, // 20.00 INR (paise)
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer paise value',
      },
    },
    freeDeliveryAbove: {
      type: Number,
      required: true,
      min: 0,
      default: 29900, // 299.00 INR (paise)
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer paise value',
      },
    },
    minOrder: {
      type: Number,
      required: true,
      min: 0,
      default: 9900, // 99.00 INR (paise)
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer paise value',
      },
    },
    supportsDelivery: {
      type: Boolean,
      default: true,
    },
    supportsPickup: {
      type: Boolean,
      default: true,
    },
    gstNumber: {
      type: String,
      default: '',
      trim: true,
    },
    fssaiNumber: {
      type: String,
      default: '',
      trim: true,
    },
    ratingAvg: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

// 2dsphere index for geospatial nearby search
storeSchema.index({ location: '2dsphere' });

const Store = mongoose.model('Store', storeSchema);

module.exports = Store;
