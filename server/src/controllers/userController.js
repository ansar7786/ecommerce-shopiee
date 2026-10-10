const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const authService = require('../services/authService');

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit number starting with 6-9')
      .optional(),
    language: z.enum(['en', 'te']).optional(),
  })
  .strict();

const updateMe = asyncHandler(async (req, res, next) => {
  const parseResult = updateProfileSchema.safeParse(req.body);

  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const { name, phone, language } = parseResult.data;

  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  if (language !== undefined) req.user.language = language;

  await req.user.save();

  res.status(200).json({
    success: true,
    user: req.user,
  });
});

const addressInputSchema = z.object({
  label: z.enum(['Home', 'Work', 'Other']).default('Home'),
  line: z.string().trim().min(3, 'Address line is required').max(300),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'PIN code must be a 6-digit number'),
  landmark: z.string().trim().max(100).optional().default(''),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDefault: z.boolean().optional(),
});

const updateAddressInputSchema = z.object({
  label: z.enum(['Home', 'Work', 'Other']).optional(),
  line: z.string().trim().min(3).max(300).optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'PIN code must be a 6-digit number')
    .optional(),
  landmark: z.string().trim().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/users/me/addresses
const getAddresses = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    addresses: req.user.addresses || [],
  });
});

// POST /api/users/me/addresses
const addAddress = asyncHandler(async (req, res, next) => {
  const parsed = addressInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const { label, line, pincode, landmark, latitude, longitude, isDefault } = parsed.data;

  const willBeDefault = isDefault || req.user.addresses.length === 0;

  if (willBeDefault) {
    req.user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
  }

  const newAddress = {
    label,
    line,
    pincode,
    landmark: landmark || '',
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    isDefault: willBeDefault,
  };

  req.user.addresses.push(newAddress);
  await req.user.save();

  const created = req.user.addresses[req.user.addresses.length - 1];

  res.status(201).json({
    success: true,
    message: 'Address added successfully',
    address: created,
    addresses: req.user.addresses,
  });
});

// PATCH /api/users/me/addresses/:addressId
const updateAddress = asyncHandler(async (req, res, next) => {
  const { addressId } = req.params;
  const parsed = updateAddressInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const addr = req.user.addresses.id(addressId);
  if (!addr) {
    return next(new AppError(404, 'NOT_FOUND', 'Address not found'));
  }

  const { label, line, pincode, landmark, latitude, longitude, isDefault } = parsed.data;

  if (label !== undefined) addr.label = label;
  if (line !== undefined) addr.line = line;
  if (pincode !== undefined) addr.pincode = pincode;
  if (landmark !== undefined) addr.landmark = landmark;

  if (latitude !== undefined && longitude !== undefined) {
    addr.location = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };
  }

  if (isDefault === true) {
    req.user.addresses.forEach((item) => {
      item.isDefault = false;
    });
    addr.isDefault = true;
  }

  await req.user.save();

  res.status(200).json({
    success: true,
    message: 'Address updated successfully',
    address: addr,
    addresses: req.user.addresses,
  });
});

// DELETE /api/users/me/addresses/:addressId
const deleteAddress = asyncHandler(async (req, res, next) => {
  const { addressId } = req.params;

  const addr = req.user.addresses.id(addressId);
  if (!addr) {
    return next(new AppError(404, 'NOT_FOUND', 'Address not found'));
  }

  const wasDefault = addr.isDefault;
  req.user.addresses.pull(addressId);

  if (wasDefault && req.user.addresses.length > 0) {
    req.user.addresses[0].isDefault = true;
  }

  await req.user.save();

  res.status(200).json({
    success: true,
    message: 'Address deleted successfully',
    addresses: req.user.addresses,
  });
});

// DELETE /api/users/me (Soft delete)
const deleteMe = asyncHandler(async (req, res) => {
  const user = req.user;

  user.name = 'Deleted User';
  user.email = `deleted_${user._id}@deleted.local`;
  user.phone = '';
  user.googleId = undefined;
  user.isBlocked = true;
  user.addresses = [];

  await user.save();

  authService.clearTokenCookie(res);

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully',
  });
});

module.exports = {
  updateMe,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  deleteMe,
};
