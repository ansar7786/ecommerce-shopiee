const { CUSTOMER, STORE_OWNER } = require('../constants/roles');
const AppError = require('../utils/AppError');

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    // Customer routes must also allow store_owner
    const effectiveRoles = new Set(allowedRoles);
    if (effectiveRoles.has(CUSTOMER)) {
      effectiveRoles.add(STORE_OWNER);
    }

    if (!effectiveRoles.has(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Access denied for your role'));
    }

    next();
  };
};

module.exports = requireRole;
