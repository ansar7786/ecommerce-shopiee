const express = require('express');
const auth = require('../middleware/auth');
const { createReview, getReviewByOrder } = require('../controllers/reviewController');

const router = express.Router();

router.use(auth);

router.post('/', createReview);
router.get('/order/:orderId', getReviewByOrder);

module.exports = router;
