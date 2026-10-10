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
const Counter = require('../src/models/Counter');
const { JWT_SECRET } = require('../src/config/env');
const { PLACED } = require('../src/constants/orderStatus');

describe('Step 14: API Security Tests', () => {
  jest.setTimeout(30000);

  let customerUser;
  let blockedCustomer;
  let storeOwner1;
  let storeOwner2;
  let adminUser;
  let store1;
  let store2;
  let category;
  let masterProduct;
  let storeProduct1;
  let storeProduct2;
  let store2Order;

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
      dbName: 'kirana_test_security',
    });

    await Promise.all([
      User.deleteMany({}),
      Store.deleteMany({}),
      Category.deleteMany({}),
      MasterProduct.deleteMany({}),
      StoreProduct.deleteMany({}),
      Order.deleteMany({}),
      Payment.deleteMany({}),
      Counter.deleteMany({}),
    ]);

    // Create Category
    category = await Category.create({
      name: 'Staples & Grains',
      nameTe: 'ధాన్యాలు',
      icon: '🌾',
      sortOrder: 1,
      isActive: true,
    });

    // Create Master Product (MRP = ₹100 = 10000 paise)
    masterProduct = await MasterProduct.create({
      name: 'Sona Masoori Rice 1kg',
      nameTe: 'సోనా మసూరి బియ్యం',
      category: category._id,
      brand: 'Royal',
      unit: '1 kg',
      mrp: 10000,
      photo: 'https://images.unsplash.com/photo-1586201375761-83865001e31c',
      isActive: true,
    });

    // Create Users
    customerUser = await User.create({
      name: 'Regular Customer',
      email: 'customer.sec@test.com',
      role: 'customer',
      phone: '9876543210',
      isBlocked: false,
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

    blockedCustomer = await User.create({
      name: 'Blocked Malicious User',
      email: 'blocked.sec@test.com',
      role: 'customer',
      phone: '9876543219',
      isBlocked: true,
      addresses: [
        {
          label: 'Home',
          line: 'Bypass Road, Gudlavalleru',
          pincode: '521356',
          location: { type: 'Point', coordinates: [81.054, 16.343] },
          isDefault: true,
        },
      ],
    });

    storeOwner1 = await User.create({
      name: 'Store Owner One',
      email: 'owner1.sec@test.com',
      role: 'store_owner',
      phone: '9876543211',
      isBlocked: false,
    });

    storeOwner2 = await User.create({
      name: 'Store Owner Two',
      email: 'owner2.sec@test.com',
      role: 'store_owner',
      phone: '9876543212',
      isBlocked: false,
    });

    adminUser = await User.create({
      name: 'Platform Super Admin',
      email: 'admin.sec@test.com',
      role: 'admin',
      phone: '9876543213',
      isBlocked: false,
    });

    // Create Store 1
    store1 = await Store.create({
      owner: storeOwner1._id,
      name: 'Krishna Kirana Store 1',
      slug: 'krishna-kirana-store-1',
      phone: '9876543211',
      address: 'Station Road, Gudlavalleru',
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

    // Create Store 2
    store2 = await Store.create({
      owner: storeOwner2._id,
      name: 'Balaji Provisions Store 2',
      slug: 'balaji-provisions-store-2',
      phone: '9876543212',
      address: 'College Road, Gudlavalleru',
      pincode: '521356',
      location: { type: 'Point', coordinates: [81.054, 16.343] },
      status: 'approved',
      isOpen: true,
      timings: { open: '00:00', close: '23:59' },
      deliveryRadiusKm: 5,
      deliveryFee: 2500,
      freeDeliveryAbove: 35000,
      minOrder: 5000,
      supportsDelivery: true,
      supportsPickup: true,
    });

    // Products for Store 1 & Store 2
    storeProduct1 = await StoreProduct.create({
      store: store1._id,
      masterProduct: masterProduct._id,
      price: 9000, // ₹90 <= MRP ₹100
      mrp: 10000,
      inStock: true,
      isActive: true,
    });

    storeProduct2 = await StoreProduct.create({
      store: store2._id,
      masterProduct: masterProduct._id,
      price: 9500, // ₹95 <= MRP ₹100
      mrp: 10000,
      inStock: true,
      isActive: true,
    });

    // Order belonging to Store 2
    const pay2 = await Payment.create({
      user: customerUser._id,
      method: 'COD',
      amount: 12000,
      status: 'SUCCESS',
    });

    store2Order = await Order.create({
      orderNo: 'KR-2001',
      customer: customerUser._id,
      store: store2._id,
      items: [
        {
          storeProductId: storeProduct2._id,
          name: masterProduct.name,
          nameTe: masterProduct.nameTe,
          unit: masterProduct.unit,
          price: 9500,
          qty: 1,
          available: true,
        },
      ],
      addressSnapshot: {
        label: 'Home',
        line: 'Main Road',
        pincode: '521356',
        location: { type: 'Point', coordinates: [81.054, 16.343] },
      },
      fulfilment: 'delivery',
      subtotal: 9500,
      deliveryFee: 2500,
      total: 12000,
      payment: pay2._id,
      paymentMethod: 'COD',
      paymentStatus: 'SUCCESS',
      status: PLACED,
      statusHistory: [
        { status: PLACED, at: new Date(), by: customerUser._id, byRole: 'customer' },
      ],
      expiresAt: new Date(Date.now() + 180000),
      idempotencyKey: 'idem-store2-order-001',
    });
    pay2.order = store2Order._id;
    await pay2.save();
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
      Counter.deleteMany({}),
    ]);
    await mongoose.connection.close();
  });

  // =========================================================================
  // 1. Customer cannot call /api/admin/* or /api/store/*
  // =========================================================================
  describe('1. Role Authorization Boundaries', () => {
    test('admin user can access /api/admin/stats (returns 200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Cookie', [getCookie(adminUser)]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('customer cannot access /api/admin/stats (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Cookie', [getCookie(customerUser)]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    test('customer cannot access /api/admin/users (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Cookie', [getCookie(customerUser)]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    test('customer cannot access /api/store/me (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/store/me')
        .set('Cookie', [getCookie(customerUser)]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    test('customer cannot access /api/store/orders (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/store/orders')
        .set('Cookie', [getCookie(customerUser)]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    test('customer cannot access /api/store/analytics (returns 403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/store/analytics')
        .set('Cookie', [getCookie(customerUser)]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 2. Store cannot read or modify another store\'s orders or products
  // =========================================================================
  describe('2. Multi-Store Isolation (Tenant Separation)', () => {
    test('store 1 owner cannot read store 2 order (returns 404 NOT_FOUND)', async () => {
      const res = await request(app)
        .get(`/api/store/orders/${store2Order._id}`)
        .set('Cookie', [getCookie(storeOwner1)]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    test('store 1 owner cannot accept store 2 order (returns 404 NOT_FOUND)', async () => {
      const res = await request(app)
        .patch(`/api/store/orders/${store2Order._id}/accept`)
        .set('Cookie', [getCookie(storeOwner1)]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    test('store 1 owner cannot modify store 2 product (returns 404 NOT_FOUND)', async () => {
      const res = await request(app)
        .patch(`/api/store-products/${storeProduct2._id}`)
        .set('Cookie', [getCookie(storeOwner1)])
        .send({ price: 9200, inStock: false });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');

      // Verify store 2 product unchanged
      const product = await StoreProduct.findById(storeProduct2._id);
      expect(product.price).toBe(9500);
      expect(product.inStock).toBe(true);
    });

    test('store 1 owner cannot delete store 2 product (returns 404 NOT_FOUND)', async () => {
      const res = await request(app)
        .delete(`/api/store-products/${storeProduct2._id}`)
        .set('Cookie', [getCookie(storeOwner1)]);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');

      // Verify store 2 product still active
      const product = await StoreProduct.findById(storeProduct2._id);
      expect(product.isActive).toBe(true);
    });

    test('store 1 owner GET /api/store-products only sees store 1 products', async () => {
      const res = await request(app)
        .get('/api/store-products')
        .set('Cookie', [getCookie(storeOwner1)]);

      expect(res.status).toBe(200);
      const productIds = res.body.products.map((p) => String(p._id));
      expect(productIds).toContain(String(storeProduct1._id));
      expect(productIds).not.toContain(String(storeProduct2._id));
    });
  });

  // =========================================================================
  // 3. Price above MRP is rejected
  // =========================================================================
  describe('3. Price Validation & MRP Rule Enforcement', () => {
    test('store owner cannot set product price above MRP via PATCH (returns 422 PRICE_EXCEEDS_MRP)', async () => {
      // masterProduct MRP is 10000 (₹100). Store tries setting 10500 (₹105)
      const res = await request(app)
        .patch(`/api/store-products/${storeProduct1._id}`)
        .set('Cookie', [getCookie(storeOwner1)])
        .send({ price: 10500 });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('PRICE_EXCEEDS_MRP');

      // Verify price was not updated
      const product = await StoreProduct.findById(storeProduct1._id);
      expect(product.price).toBe(9000);
    });

    test('store owner cannot bulk-add products with price above MRP (returns 422 PRICE_EXCEEDS_MRP)', async () => {
      const res = await request(app)
        .post('/api/store-products/bulk')
        .set('Cookie', [getCookie(storeOwner1)])
        .send({
          items: [
            {
              masterProductId: String(masterProduct._id),
              price: 15000, // Above 10000 MRP
            },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('PRICE_EXCEEDS_MRP');
    });

    test('store owner setting price equal to or below MRP succeeds', async () => {
      const res = await request(app)
        .patch(`/api/store-products/${storeProduct1._id}`)
        .set('Cookie', [getCookie(storeOwner1)])
        .send({ price: 9900 }); // ₹99 <= ₹100 MRP

      expect(res.status).toBe(200);
      expect(res.body.product.price).toBe(9900);
    });
  });

  // =========================================================================
  // 4. Tampered total is ignored
  // =========================================================================
  describe('4. Tamper Resistance & Server Bill Computation', () => {
    test('server rejects order if client forged a payment with tampered low amount', async () => {
      // Product price is 9900, qty 1, delivery fee 2000 => true total 11900 paise
      // Malicious customer creates a payment for 50 paise
      const fakePayment = await Payment.create({
        user: customerUser._id,
        method: 'UPI',
        upiId: 'attacker@okhdfcbank',
        amount: 50, // Tampered: 50 paise instead of 11900
        status: 'SUCCESS',
      });

      const res = await request(app)
        .post('/api/orders')
        .set('Cookie', [getCookie(customerUser)])
        .send({
          storeId: String(store1._id),
          items: [{ storeProductId: String(storeProduct1._id), qty: 1 }],
          fulfilment: 'delivery',
          addressId: String(customerUser.addresses[0]._id),
          paymentId: String(fakePayment._id),
          idempotencyKey: 'idem-tamper-test-01',
          total: 50, // Tampered payload
          subtotal: 50,
          deliveryFee: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PAYMENT_AMOUNT_MISMATCH');
    });

    test('server ignores client-supplied total and subtotal, computing true bill from DB', async () => {
      // True bill: 9900 item + 2000 delivery = 11900 paise
      const legitimatePayment = await Payment.create({
        user: customerUser._id,
        method: 'UPI',
        upiId: 'customer@okaxis',
        amount: 11900,
        status: 'SUCCESS',
      });

      const res = await request(app)
        .post('/api/orders')
        .set('Cookie', [getCookie(customerUser)])
        .send({
          storeId: String(store1._id),
          items: [{ storeProductId: String(storeProduct1._id), qty: 1 }],
          fulfilment: 'delivery',
          addressId: String(customerUser.addresses[0]._id),
          paymentId: String(legitimatePayment._id),
          idempotencyKey: 'idem-tamper-test-02',
          total: 99, // Tampered fields in request body
          subtotal: 10,
          deliveryFee: 0,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // The server recorded the authoritative total, ignoring the client's 99 paise
      expect(res.body.order.subtotal).toBe(9900);
      expect(res.body.order.deliveryFee).toBe(2000);
      expect(res.body.order.total).toBe(11900);
    });
  });

  // =========================================================================
  // 5. Double POST /orders with same idempotencyKey creates one order
  // =========================================================================
  describe('5. Idempotent Order Creation', () => {
    test('double POST /api/orders with the same idempotencyKey creates exactly one order', async () => {
      const payment1 = await Payment.create({
        user: customerUser._id,
        method: 'COD',
        amount: 11900,
        status: 'SUCCESS',
      });

      const orderPayload = {
        storeId: String(store1._id),
        items: [{ storeProductId: String(storeProduct1._id), qty: 1 }],
        fulfilment: 'delivery',
        addressId: String(customerUser.addresses[0]._id),
        paymentId: String(payment1._id),
        idempotencyKey: 'idem-duplicate-safe-key-99',
      };

      // First POST
      const res1 = await request(app)
        .post('/api/orders')
        .set('Cookie', [getCookie(customerUser)])
        .send(orderPayload);

      expect(res1.status).toBe(201);
      const orderId1 = res1.body.order._id;
      expect(orderId1).toBeDefined();

      // Second POST with identical idempotencyKey
      const res2 = await request(app)
        .post('/api/orders')
        .set('Cookie', [getCookie(customerUser)])
        .send(orderPayload);

      // Should return either 200 or 201 with the exact same order
      expect([200, 201]).toContain(res2.status);
      expect(res2.body.order._id).toBe(orderId1);

      // Verify in DB only 1 record exists with this idempotency key
      const count = await Order.countDocuments({
        customer: customerUser._id,
        idempotencyKey: 'idem-duplicate-safe-key-99',
      });
      expect(count).toBe(1);
    });
  });

  // =========================================================================
  // 6. Blocked users are refused
  // =========================================================================
  describe('6. Blocked User Access Enforcement', () => {
    test('blocked user calling GET /api/users/me is refused (returns 403 ACCOUNT_BLOCKED)', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Cookie', [getCookie(blockedCustomer)]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_BLOCKED');
    });

    test('blocked user calling GET /api/orders/my is refused (returns 403 ACCOUNT_BLOCKED)', async () => {
      const res = await request(app)
        .get('/api/orders/my')
        .set('Cookie', [getCookie(blockedCustomer)]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_BLOCKED');
    });

    test('blocked user calling POST /api/orders is refused (returns 403 ACCOUNT_BLOCKED)', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Cookie', [getCookie(blockedCustomer)])
        .send({
          storeId: String(store1._id),
          items: [{ storeProductId: String(storeProduct1._id), qty: 1 }],
          fulfilment: 'delivery',
          paymentId: '600000000000000000000001',
          idempotencyKey: 'idem-blocked-test-01',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_BLOCKED');
    });
  });
});
