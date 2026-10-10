/* global describe, test, expect, beforeAll, afterAll, jest */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');
const Store = require('../src/models/Store');
const Category = require('../src/models/Category');
const MasterProduct = require('../src/models/MasterProduct');
const StoreProduct = require('../src/models/StoreProduct');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const { JWT_SECRET } = require('../src/config/env');

describe('Step 15: Cross-Role Bridges Integration Tests', () => {
  jest.setTimeout(120000);

  let adminUser;
  let customerUser;
  let storeOwner1;
  let storeOwner2;
  let blockedStoreOwner;

  let approvedStore;
  let suspendedStore;
  let blockedOwnerStore;
  let activeStoreProduct;
  let outOfStockProduct;

  const getCookie = (user) => {
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    return `token=${token}`;
  };

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGO_URI_TEST ||
      process.env.MONGO_URI ||
      'mongodb://127.0.0.1:27017/kirana_test_db';

    await mongoose.connect(mongoUri, {
      dbName: 'kirana_test_bridges',
    });

    await Promise.all([
      User.deleteMany({}),
      Store.deleteMany({}),
      Category.deleteMany({}),
      MasterProduct.deleteMany({}),
      StoreProduct.deleteMany({}),
      Order.deleteMany({}),
      Payment.deleteMany({}),
    ]);

    // 1. Create Users
    adminUser = await User.create({
      name: 'Admin Bridge',
      email: 'admin.bridge@test.com',
      role: 'admin',
      phone: '9900000001',
    });

    customerUser = await User.create({
      name: 'Customer Bridge',
      email: 'customer.bridge@test.com',
      role: 'customer',
      phone: '9900000002',
      addresses: [
        {
          label: 'Home',
          line: 'Main Road, Gudlavalleru',
          pincode: '521356',
          location: { type: 'Point', coordinates: [81.054, 16.343] },
          isDefault: true,
        },
      ],
    });

    storeOwner1 = await User.create({
      name: 'Store Owner One',
      email: 'owner1.bridge@test.com',
      role: 'store_owner',
      phone: '9900000003',
    });

    storeOwner2 = await User.create({
      name: 'Store Owner Two',
      email: 'owner2.bridge@test.com',
      role: 'store_owner',
      phone: '9900000004',
    });

    blockedStoreOwner = await User.create({
      name: 'Blocked Store Owner',
      email: 'blocked.owner@test.com',
      role: 'store_owner',
      phone: '9900000005',
      isBlocked: true,
    });

    // 2. Create Category and Master Product
    const category = await Category.create({
      name: 'Grains & Staples',
      nameTe: 'ధాన్యాలు',
      icon: '🌾',
      sortOrder: 1,
      isActive: true,
    });

    const masterProduct = await MasterProduct.create({
      name: 'Sona Masoori Rice 1kg',
      nameTe: 'సోనా మసూరి బియ్యం',
      category: category._id,
      brand: 'Bridges Brand',
      unit: '1 kg',
      mrp: 8000,
      photo: 'https://images.unsplash.com/photo-1586201375761-83865001e31c',
      isActive: true,
    });

    const masterProduct2 = await MasterProduct.create({
      name: 'Toor Dal 1kg',
      nameTe: 'కందిపప్పు',
      category: category._id,
      brand: 'Bridges Brand',
      unit: '1 kg',
      mrp: 8500,
      photo: 'https://images.unsplash.com/photo-1586201375761-83865001e31c',
      isActive: true,
    });

    // 3. Approved Store
    approvedStore = await Store.create({
      owner: storeOwner1._id,
      name: 'Approved Kirana Store',
      slug: 'approved-kirana-store',
      phone: '9900000003',
      address: 'Main Bazaar, Gudlavalleru',
      pincode: '521356',
      location: { type: 'Point', coordinates: [81.054, 16.343] },
      status: 'approved',
      isOpen: true,
      timings: { open: '00:00', close: '23:59' },
      deliveryRadiusKm: 5,
      deliveryFee: 2000,
      freeDeliveryAbove: 30000,
      minOrder: 5000,
      supportsDelivery: true,
      supportsPickup: true,
    });

    // Products in Approved Store
    activeStoreProduct = await StoreProduct.create({
      store: approvedStore._id,
      masterProduct: masterProduct._id,
      price: 7500,
      mrp: 8000,
      inStock: true,
      isActive: true,
    });

    outOfStockProduct = await StoreProduct.create({
      store: approvedStore._id,
      masterProduct: masterProduct2._id,
      price: 7800,
      mrp: 8500,
      inStock: false,
      isActive: true,
    });

    // 4. Suspended Store
    suspendedStore = await Store.create({
      owner: storeOwner2._id,
      name: 'Suspended Provisions',
      slug: 'suspended-provisions',
      phone: '9900000004',
      address: 'College Road, Gudlavalleru',
      pincode: '521356',
      location: { type: 'Point', coordinates: [81.054, 16.343] },
      status: 'suspended',
      isOpen: true,
      timings: { open: '00:00', close: '23:59' },
      deliveryRadiusKm: 5,
      deliveryFee: 2500,
      freeDeliveryAbove: 35000,
      minOrder: 5000,
      supportsDelivery: true,
      supportsPickup: true,
    });

    await StoreProduct.create({
      store: suspendedStore._id,
      masterProduct: masterProduct._id,
      price: 7500,
      mrp: 8000,
      inStock: true,
      isActive: true,
    });

    // 5. Store of Blocked Owner
    blockedOwnerStore = await Store.create({
      owner: blockedStoreOwner._id,
      name: 'Blocked Owner Store',
      slug: 'blocked-owner-store',
      phone: '9900000005',
      address: 'Bypass Road, Gudlavalleru',
      pincode: '521356',
      location: { type: 'Point', coordinates: [81.054, 16.343] },
      status: 'approved',
      isOpen: true,
      timings: { open: '00:00', close: '23:59' },
      deliveryRadiusKm: 5,
      deliveryFee: 2000,
      freeDeliveryAbove: 30000,
      minOrder: 5000,
      supportsDelivery: true,
      supportsPickup: true,
    });
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({}),
      Store.deleteMany({}),
      Category.deleteMany({}),
      MasterProduct.deleteMany({}),
      StoreProduct.deleteMany({}),
      Order.deleteMany({}),
      Payment.deleteMany({}),
    ]);
    await mongoose.connection.close();
  });

  // =========================================================================
  // BRIDGE 1: Store registration -> Admin
  // =========================================================================
  describe('BRIDGE 1: Store registration -> Admin', () => {
    let newStoreOwner;
    let registeredStoreId;

    beforeAll(async () => {
      newStoreOwner = await User.create({
        name: 'Applicant Owner',
        email: 'applicant.bridge@test.com',
        role: 'store_owner',
        phone: '9911223344',
      });
    });

    test('1. Store owner submits POST /api/stores/register -> saved with status "pending"', async () => {
      const payload = {
        name: 'New Pending Kirana',
        phone: '9911223344',
        address: 'Gandhi Chowk, Gudlavalleru',
        pincode: '521356',
        latitude: 16.343,
        longitude: 81.054,
        deliveryRadiusKm: 3,
        deliveryFee: 2000,
        freeDeliveryAbove: 29900,
        minOrder: 9900,
        supportsDelivery: true,
        supportsPickup: true,
      };

      const res = await request(app)
        .post('/api/stores/register')
        .set('Cookie', [getCookie(newStoreOwner)])
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.store.status).toBe('pending');
      registeredStoreId = res.body.store._id;
    });

    test('2. Pending store appears in admin list GET /api/admin/stores?status=pending', async () => {
      const res = await request(app)
        .get('/api/admin/stores?status=pending')
        .set('Cookie', [getCookie(adminUser)]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const storeIds = res.body.stores.map((s) => String(s._id));
      expect(storeIds).toContain(String(registeredStoreId));
    });

    test('3. Store owner cannot call GET /api/admin/* (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/admin/stores')
        .set('Cookie', [getCookie(newStoreOwner)]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    test('4. Customer cannot call GET /api/admin/* (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/admin/stores')
        .set('Cookie', [getCookie(customerUser)]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // BRIDGE 2: Admin decision -> Store owner
  // =========================================================================
  describe('BRIDGE 2: Admin decision -> Store owner', () => {
    let storeToApprove;
    let storeToReject;
    let ownerForReject;

    beforeAll(async () => {
      const ownerForApprove = await User.create({
        name: 'Owner To Approve',
        email: 'approve.bridge@test.com',
        role: 'store_owner',
        phone: '9922334455',
      });

      ownerForReject = await User.create({
        name: 'Owner To Reject',
        email: 'reject.bridge@test.com',
        role: 'store_owner',
        phone: '9933445566',
      });

      storeToApprove = await Store.create({
        owner: ownerForApprove._id,
        name: 'Store To Approve',
        slug: 'store-to-approve',
        phone: '9922334455',
        address: 'Bazaar Street, Gudlavalleru',
        pincode: '521356',
        location: { type: 'Point', coordinates: [81.054, 16.343] },
        status: 'pending',
        deliveryRadiusKm: 3,
      });

      storeToReject = await Store.create({
        owner: ownerForReject._id,
        name: 'Store To Reject',
        slug: 'store-to-reject',
        phone: '9933445566',
        address: 'Market Yard, Gudlavalleru',
        pincode: '521356',
        location: { type: 'Point', coordinates: [81.054, 16.343] },
        status: 'pending',
        deliveryRadiusKm: 3,
      });
    });

    test('1. Customer cannot approve a store (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .patch(`/api/admin/stores/${storeToApprove._id}/status`)
        .set('Cookie', [getCookie(customerUser)])
        .send({ action: 'approve' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    test('2. Store owner cannot approve a store (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .patch(`/api/admin/stores/${storeToApprove._id}/status`)
        .set('Cookie', [getCookie(storeOwner1)])
        .send({ action: 'approve' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    test('3. Admin approves pending store: status becomes "approved", rejectionReason cleared', async () => {
      const res = await request(app)
        .patch(`/api/admin/stores/${storeToApprove._id}/status`)
        .set('Cookie', [getCookie(adminUser)])
        .send({ action: 'approve' });

      expect(res.status).toBe(200);
      expect(res.body.store.status).toBe('approved');
      expect(res.body.store.rejectionReason).toBe('');
    });

    test('4. Approving an already approved store returns 409 INVALID_TRANSITION', async () => {
      const res = await request(app)
        .patch(`/api/admin/stores/${storeToApprove._id}/status`)
        .set('Cookie', [getCookie(adminUser)])
        .send({ action: 'approve' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_TRANSITION');
    });

    test('5. Admin suspends approved store -> status becomes "suspended"', async () => {
      const res = await request(app)
        .patch(`/api/admin/stores/${storeToApprove._id}/status`)
        .set('Cookie', [getCookie(adminUser)])
        .send({ action: 'suspend' });

      expect(res.status).toBe(200);
      expect(res.body.store.status).toBe('suspended');
    });

    test('6. Suspending an already suspended store returns 409 INVALID_TRANSITION', async () => {
      const res = await request(app)
        .patch(`/api/admin/stores/${storeToApprove._id}/status`)
        .set('Cookie', [getCookie(adminUser)])
        .send({ action: 'suspend' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_TRANSITION');
    });

    test('7. Admin reactivates suspended store -> status becomes "approved"', async () => {
      const res = await request(app)
        .patch(`/api/admin/stores/${storeToApprove._id}/status`)
        .set('Cookie', [getCookie(adminUser)])
        .send({ action: 'reactivate' });

      expect(res.status).toBe(200);
      expect(res.body.store.status).toBe('approved');
    });

    test('8. Rejecting without a reason returns 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/api/admin/stores/${storeToReject._id}/status`)
        .set('Cookie', [getCookie(adminUser)])
        .send({ action: 'reject', rejectionReason: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('9. Admin rejects pending store: status becomes "rejected" with reason saved', async () => {
      const res = await request(app)
        .patch(`/api/admin/stores/${storeToReject._id}/status`)
        .set('Cookie', [getCookie(adminUser)])
        .send({ action: 'reject', rejectionReason: 'FSSAI document unreadable' });

      expect(res.status).toBe(200);
      expect(res.body.store.status).toBe('rejected');
      expect(res.body.store.rejectionReason).toBe('FSSAI document unreadable');
    });

    test('10. Rejecting an already rejected store returns 409 INVALID_TRANSITION', async () => {
      const res = await request(app)
        .patch(`/api/admin/stores/${storeToReject._id}/status`)
        .set('Cookie', [getCookie(adminUser)])
        .send({ action: 'reject', rejectionReason: 'Duplicate rejection' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_TRANSITION');
    });

    test('11. Resubmit after rejection resets status to "pending" and shows for admin again', async () => {
      // Store owner resubmits via POST /api/stores/register
      const res = await request(app)
        .post('/api/stores/register')
        .set('Cookie', [getCookie(ownerForReject)])
        .send({
          name: 'Store To Reject (Updated)',
          phone: '9933445566',
          address: 'Market Yard Renovated, Gudlavalleru',
          pincode: '521356',
          latitude: 16.343,
          longitude: 81.054,
          deliveryRadiusKm: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body.store.status).toBe('pending');
      expect(res.body.store.rejectionReason).toBe('');

      // Verify it appears in pending admin query
      const adminList = await request(app)
        .get('/api/admin/stores?status=pending')
        .set('Cookie', [getCookie(adminUser)]);

      expect(adminList.status).toBe(200);
      const ids = adminList.body.stores.map((s) => String(s._id));
      expect(ids).toContain(String(storeToReject._id));
    });
  });

  // =========================================================================
  // BRIDGE 3: Store -> Customer
  // =========================================================================
  describe('BRIDGE 3: Store -> Customer Visibility & Integrity', () => {
    test('1. GET /api/stores/nearby shows only approved stores of active owners', async () => {
      const res = await request(app)
        .get('/api/stores/nearby?lat=16.343&lng=81.054')
        .set('Cookie', [getCookie(customerUser)]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const storeNames = res.body.stores.map((s) => s.name);
      // Approved store of active owner MUST be present
      expect(storeNames).toContain('Approved Kirana Store');

      // Suspended store MUST NOT be present
      expect(storeNames).not.toContain('Suspended Provisions');

      // Store of blocked owner MUST NOT be present
      expect(storeNames).not.toContain('Blocked Owner Store');
    });

    test('2. Suspended store cannot be fetched directly via GET /api/stores/:id (returns 404)', async () => {
      const res = await request(app).get(`/api/stores/${suspendedStore._id}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    test('3. Suspended store products cannot be fetched via GET /api/stores/:id/products (returns 404)', async () => {
      const res = await request(app).get(`/api/stores/${suspendedStore._id}/products`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    test('4. Direct cart validate against suspended store returns 404 STORE_NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/cart/validate')
        .send({
          storeId: String(suspendedStore._id),
          items: [{ storeProductId: '507f1f77bcf86cd799439011', qty: 1 }],
          fulfilment: 'delivery',
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('STORE_NOT_FOUND');
    });

    test('5. Direct order creation against suspended store returns 404 STORE_NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Cookie', [getCookie(customerUser)])
        .send({
          storeId: String(suspendedStore._id),
          items: [{ storeProductId: '507f1f77bcf86cd799439011', qty: 1 }],
          fulfilment: 'delivery',
          paymentId: '507f1f77bcf86cd799439022',
          idempotencyKey: 'idem-bridge-suspended-fail',
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('STORE_NOT_FOUND');
    });

    test('6. Store of blocked owner cannot be fetched directly (returns 404)', async () => {
      const res = await request(app).get(`/api/stores/${blockedOwnerStore._id}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    test('7. Products appear on customer store page with accurate price and stock status', async () => {
      const res = await request(app).get(`/api/stores/${approvedStore._id}/products`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const inStock = res.body.products.find((p) => String(p._id) === String(activeStoreProduct._id));
      const outStock = res.body.products.find((p) => String(p._id) === String(outOfStockProduct._id));

      expect(inStock).toBeDefined();
      expect(inStock.price).toBe(7500);
      expect(inStock.inStock).toBe(true);

      expect(outStock).toBeDefined();
      expect(outStock.price).toBe(7800);
      expect(outStock.inStock).toBe(false);
    });
  });
});
