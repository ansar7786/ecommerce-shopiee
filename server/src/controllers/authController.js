const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const authService = require('../services/authService');
const { CUSTOMER, STORE_OWNER } = require('../constants/roles');

const signupSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9_]{3,20}$/,
        'Username must be 3-20 characters long and contain only lowercase letters, numbers, and underscores',
      ),
    password: z.string().min(6, 'Password must be at least 6 characters').max(72, 'Password cannot exceed 72 characters'),
    name: z.string().trim().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit number starting with 6-9'),
    role: z.enum([CUSTOMER, STORE_OWNER], {
      errorMap: () => ({ message: 'Role must be customer or store_owner' }),
    }),
  })
  .strict();

const loginSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{3,20}$/, 'Invalid username format'),
    password: z.string().min(1, 'Password is required').max(72),
    role: z.enum([CUSTOMER, STORE_OWNER], {
      errorMap: () => ({ message: 'Role must be customer or store_owner' }),
    }),
  })
  .strict();

const adminLoginSchema = z
  .object({
    username: z.string().trim().toLowerCase().min(1, 'Username is required').max(50),
    password: z.string().min(1, 'Password is required').max(72),
  })
  .strict();

const signup = asyncHandler(async (req, res, next) => {
  const parseResult = signupSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const user = await authService.signup(parseResult.data);
  authService.sendTokenCookie(res, user);

  res.status(201).json({
    success: true,
    user,
  });
});

const login = asyncHandler(async (req, res, next) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const user = await authService.login(parseResult.data);
  authService.sendTokenCookie(res, user);

  res.status(200).json({
    success: true,
    user,
  });
});

const adminLogin = asyncHandler(async (req, res, next) => {
  const parseResult = adminLoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const user = await authService.adminLogin(parseResult.data);
  authService.sendTokenCookie(res, user);

  res.status(200).json({
    success: true,
    user,
  });
});

const demoLogin = asyncHandler(async (req, res, next) => {
  const { role } = req.body;

  if (!role) {
    return next(new AppError(400, 'INVALID_INPUT', 'Role is required for demo login'));
  }

  const user = await authService.demoLogin(role);
  authService.sendTokenCookie(res, user);

  res.status(200).json({
    success: true,
    user,
  });
});

const logout = asyncHandler(async (req, res) => {
  authService.clearTokenCookie(res);
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

module.exports = {
  signup,
  login,
  adminLogin,
  demoLogin,
  logout,
  getMe,
};
