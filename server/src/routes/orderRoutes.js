const express = require('express');
const {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  respondToChanges,
  reorderCheck,
} = require('../controllers/orderController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.post('/', createOrder);
router.get('/my', getMyOrders);
router.get('/:id', getOrderById);
router.post('/:id/reorder-check', reorderCheck);
router.patch('/:id/cancel', cancelOrder);
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/respond-changes', respondToChanges);

module.exports = router;
