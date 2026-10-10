const express = require('express');
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/me', auth, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});
router.patch('/me', auth, userController.updateMe);
router.delete('/me', auth, userController.deleteMe);
router.get('/me/addresses', auth, userController.getAddresses);
router.post('/me/addresses', auth, userController.addAddress);
router.patch('/me/addresses/:addressId', auth, userController.updateAddress);
router.delete('/me/addresses/:addressId', auth, userController.deleteAddress);

module.exports = router;
