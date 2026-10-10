const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const upload = require('../middleware/upload');
const { ADMIN } = require('../constants/roles');
const adminController = require('../controllers/adminController');

const router = express.Router();

// Enforce authentication & admin role on all admin routes
router.use(auth, requireRole(ADMIN));

// Dashboard Stats
router.get('/stats', adminController.getAdminStats);

// Users Management
router.get('/users', adminController.listUsers);
router.patch('/users/:id', adminController.updateUser);

// Orders Management
router.get('/orders', adminController.listAdminOrders);
router.get('/orders/:id', adminController.getAdminOrderById);
router.patch('/orders/:id/force-cancel', adminController.forceCancelOrder);

// Complaints Management
router.get('/complaints', adminController.listComplaints);
router.patch('/complaints/:id', adminController.updateComplaint);

// Reports Export
router.get('/reports/export', adminController.exportReport);

// Categories CRUD
router.get('/categories', adminController.listCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Master Products CRUD
router.get('/master-products', adminController.listMasterProducts);
router.post('/master-products', adminController.createMasterProduct);
router.put('/master-products/:id', adminController.updateMasterProduct);
router.delete('/master-products/:id', adminController.deleteMasterProduct);
router.post(
  '/master-products/:id/image',
  upload.single('image'),
  adminController.updateProductImage,
);

// Stores Management
router.get('/stores', adminController.listAdminStores);
router.get('/stores/:id', adminController.getAdminStoreById);
router.patch('/stores/:id/status', adminController.updateAdminStoreStatus);
router.patch('/stores/:id', adminController.updateAdminStoreStatus);

module.exports = router;
