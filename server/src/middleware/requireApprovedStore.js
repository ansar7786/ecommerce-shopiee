const Store = require('../models/Store');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const requireApprovedStore = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  }

  const store = await Store.findOne({ owner: req.user._id, status: 'approved' });
  if (!store) {
    return next(
      new AppError(
        403,
        'STORE_NOT_APPROVED',
        'You must have an approved store to manage inventory and catalogue products',
      ),
    );
  }

  req.store = store;
  next();
});

module.exports = requireApprovedStore;
