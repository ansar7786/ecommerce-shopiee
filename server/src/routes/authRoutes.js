const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts, please try again later',
  },
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts, please try again later',
  },
});

router.use(authLimiter);

router.post('/signup', strictAuthLimiter, authController.signup);
router.post('/login', strictAuthLimiter, authController.login);
router.post('/admin/login', strictAuthLimiter, authController.adminLogin);
router.post('/demo', authController.demoLogin);
router.post('/logout', authController.logout);
router.get('/me', auth, authController.getMe);

module.exports = router;
