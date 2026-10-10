const express = require('express');
const {
  initiatePayment,
  confirmPayment,
  cancelPayment,
} = require('../controllers/paymentController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.post('/initiate', initiatePayment);
router.post('/:id/confirm', confirmPayment);
router.post('/:id/cancel', cancelPayment);

module.exports = router;
