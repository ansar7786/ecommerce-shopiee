const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const {
  getStoreOrders,
  getStoreOrderById,
  acceptOrder,
  rejectOrder,
  updateStatus,
  markItemUnavailable,
  markPaymentCollected,
  deliveryFailed,
} = require('../controllers/storeOrderController');

const router = express.Router();

router.use(auth);
router.use(requireRole('store_owner'));

router.get('/', getStoreOrders);
router.get('/:id', getStoreOrderById);
router.patch('/:id/accept', acceptOrder);
router.patch('/:id/reject', rejectOrder);
router.patch('/:id/status', updateStatus);
router.patch('/:id/items/:itemId/unavailable', markItemUnavailable);
router.patch('/:id/payment-collected', markPaymentCollected);
router.patch('/:id/delivery-failed', deliveryFailed);

module.exports = router;
