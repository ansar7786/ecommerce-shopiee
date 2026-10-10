const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const roles = require('../constants/roles');
const { uploadStore } = require('../middleware/upload');
const {
  registerStore,
  getMyStore,
  updateMyStore,
  uploadStorePhoto,
  getNearby,
  getStoreById,
  getStoreProductsPublic,
  toggleStoreOpen,
  getStoreAnalytics,
} = require('../controllers/storeController');

const router = express.Router();

// Public / Customer endpoints
router.get('/nearby', getNearby);

// Protected store owner endpoints (defined before /:id to prevent route shadowing)
const storeOwnerAuth = [auth, requireRole(roles.STORE_OWNER)];

router.post('/register', storeOwnerAuth, registerStore);
router.get('/me', storeOwnerAuth, getMyStore);
router.patch('/me', storeOwnerAuth, updateMyStore);
router.patch('/me/open', storeOwnerAuth, toggleStoreOpen);
router.post('/me/photo', storeOwnerAuth, uploadStore.single('photo'), uploadStorePhoto);
router.get('/analytics', storeOwnerAuth, getStoreAnalytics);

// Public store endpoints by ID / slug
router.get('/:id', getStoreById);
router.get('/:id/products', getStoreProductsPublic);

module.exports = router;
