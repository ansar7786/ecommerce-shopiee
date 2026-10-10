const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const requireApprovedStore = require('../middleware/requireApprovedStore');
const roles = require('../constants/roles');
const {
  bulkAddStoreProducts,
  addCustomStoreProduct,
  getMyStoreProducts,
  updateStoreProduct,
  deleteStoreProduct,
  markCategoryOutOfStock,
} = require('../controllers/storeProductController');

const router = express.Router();

// Store owners with approved store only
router.use(auth);
router.use(requireRole(roles.STORE_OWNER));
router.use(requireApprovedStore);

router.get('/', getMyStoreProducts);
router.post('/bulk', bulkAddStoreProducts);
router.post('/custom', addCustomStoreProduct);
router.patch('/category/:categoryId/out-of-stock', markCategoryOutOfStock);
router.patch('/:id', updateStoreProduct);
router.delete('/:id', deleteStoreProduct);

module.exports = router;
