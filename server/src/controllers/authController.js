const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const authService = require('../services/authService');

const googleLogin = asyncHandler(async (req, res, next) => {
  const { credential, intent } = req.body;

  if (!credential) {
    return next(new AppError(400, 'INVALID_INPUT', 'Google credential is required'));
  }

  const user = await authService.loginWithGoogle({ credential, intent });
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
  googleLogin,
  demoLogin,
  logout,
  getMe,
};
