const express = require('express');
const auth = require('../middleware/auth');
const { createComplaint, getMyComplaints } = require('../controllers/complaintController');

const router = express.Router();

router.use(auth);

router.post('/', createComplaint);
router.get('/my', getMyComplaints);

module.exports = router;
