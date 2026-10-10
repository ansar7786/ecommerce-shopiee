const express = require('express');
const { validateCart } = require('../controllers/cartController');

const router = express.Router();

router.post('/validate', validateCart);

module.exports = router;
