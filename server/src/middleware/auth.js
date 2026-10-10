const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const auth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication token missing'));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (_err) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }

  const user = await User.findById(decoded.userId);

  if (!user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'User not found'));
  }

  if (user.isBlocked) {
    return next(new AppError(403, 'ACCOUNT_BLOCKED', 'Your account has been suspended'));
  }

  req.user = user;
  next();
});

module.exports = auth;
