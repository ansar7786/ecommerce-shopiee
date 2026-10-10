const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const requireApprovedStore = require('../middleware/requireApprovedStore');
const roles = require('../constants/roles');
const { listMasterProductsForStore } = require('../controllers/storeProductController');

const router = express.Router();

// Store owners with approved store only
router.use(auth);
router.use(requireRole(roles.STORE_OWNER));
router.use(requireApprovedStore);

router.get('/', listMasterProductsForStore);

module.exports = router;
