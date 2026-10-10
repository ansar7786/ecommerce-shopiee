/* global describe, test, expect, beforeAll, afterAll, beforeEach, jest */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const Store = require('../src/models/Store');
const StoreProduct = require('../src/models/StoreProduct');
const Payment = require('../src/models/Payment');
const Counter = require('../src/models/Counter');
const User = require('../src/models/User');
const orderService = require('../src/services/orderService');
const {
  PLACED,
  ACCEPTED,
  PACKING,
  READY,
  OUT_FOR_DELIVERY,
  DELIVERED,
  AWAITING_CUSTOMER,
  REJECTED,
  CANCELLED,
  EXPIRED,
} = require('../src/constants/orderStatus');

describe('Order Service & State Machine Tests', () => {
  jest.setTimeout(30000);

  let testCustomer;
  let testStoreOwner;
  let testStore;
  let testStoreProduct;
  let testPayment;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGO_URI_TEST ||
      process.env.MONGO_URI ||
      'mongodb://127.0.0.1:27017/kirana_test_db';

    await mongoose.connect(mongoUri, {
      dbName: 'kirana_test_orders',
    });

    // Clean test collections
    await Promise.all([
      Order.deleteMany({}),
      Store.deleteMany({}),
      StoreProduct.deleteMany({}),
      Payment.deleteMany({}),
      Counter.deleteMany({}),
      User.deleteMany({}),
    ]);

    // Create test customer
    testCustomer = await User.create({
      name: 'Test Customer',
      email: 'customer@test.com',
      role: 'customer',
      phone: '9876543210',
      addresses: [
        {
          label: 'Home',
          line: 'Gudlavalleru Main St',
          pincode: '521356',
          location: {
            type: 'Point',
            coordinates: [81.054, 16.343],
          },
          isDefault: true,
        },
      ],
    });

    // Create test store owner
    testStoreOwner = await User.create({
      name: 'Test Store Owner',
      email: 'storeowner@test.com',
      role: 'store_owner',
      phone: '9876543211',
    });

    // Create test store
    testStore = await Store.create({
      owner: testStoreOwner._id,
      name: 'Test Kirana Store',
      slug: 'test-kirana-store',
      phone: '9876543211',
      address: 'Near Clock Tower, Gudlavalleru',
      pincode: '521356',
      location: {
        type: 'Point',
        coordinates: [81.054, 16.343],
      },
      status: 'approved',
      isOpen: true,
      timings: { open: '00:00', close: '23:59' }, // 24 hours open for test
      deliveryRadiusKm: 5,
      deliveryFee: 2000, // ₹20
      freeDeliveryAbove: 30000, // ₹300
      minOrder: 5000, // ₹50
      supportsDelivery: true,
      supportsPickup: true,
    });

    // Create test store product
    testStoreProduct = await StoreProduct.create({
      store: testStore._id,
      customName: 'Premium Basmati Rice 1kg',
      price: 12000, // ₹120
      mrp: 15000, // ₹150
      inStock: true,
      isActive: true,
    });
  }, 30000);

  afterAll(async () => {
    try {
      await Promise.all([
        Order.deleteMany({}),
        Store.deleteMany({}),
        StoreProduct.deleteMany({}),
        Payment.deleteMany({}),
        Counter.deleteMany({}),
        User.deleteMany({}),
      ]);
      await mongoose.disconnect();
    } catch {
      // Ignored
    }
  });

  beforeEach(async () => {
    // Create a fresh test payment for order creation
    testPayment = await Payment.create({
      user: testCustomer._id,
      method: 'COD',
      amount: 14000, // ₹120 subtotal + ₹20 delivery fee = ₹140
      status: 'SUCCESS',
    });
  });

  describe('Order Creation & Idempotency', () => {
    test('successfully creates order with status PLACED and expiresAt set to 3 minutes', async () => {
      const order = await orderService.createOrder({
        user: testCustomer,
        storeId: testStore._id,
        items: [{ storeProductId: testStoreProduct._id, qty: 1 }],
        fulfilment: 'delivery',
        addressId: testCustomer.addresses[0]._id,
        note: 'Leave at front gate',
        paymentId: testPayment._id,
        idempotencyKey: 'idemp-key-1',
      });

      expect(order).toBeDefined();
      expect(order.orderNo).toMatch(/^LC-\d+$/);
      expect(order.status).toBe(PLACED);
      expect(order.total).toBe(14000);
      expect(order.fulfilment).toBe('delivery');
      expect(order.statusHistory).toHaveLength(1);
      expect(order.statusHistory[0].status).toBe(PLACED);
      expect(new Date(order.expiresAt).getTime()).toBeGreaterThan(Date.now() + 2 * 60 * 1000);

      // Verify payment was linked
      const updatedPayment = await Payment.findById(testPayment._id);
      expect(String(updatedPayment.order)).toBe(String(order._id));
    });

    test('double submit with the same idempotencyKey creates only one order', async () => {
      const p2 = await Payment.create({
        user: testCustomer._id,
        method: 'COD',
        amount: 14000,
        status: 'SUCCESS',
      });

      const order1 = await orderService.createOrder({
        user: testCustomer,
        storeId: testStore._id,
        items: [{ storeProductId: testStoreProduct._id, qty: 1 }],
        fulfilment: 'delivery',
        addressId: testCustomer.addresses[0]._id,
        paymentId: p2._id,
        idempotencyKey: 'same-idemp-key-100',
      });

      const order2 = await orderService.createOrder({
        user: testCustomer,
        storeId: testStore._id,
        items: [{ storeProductId: testStoreProduct._id, qty: 1 }],
        fulfilment: 'delivery',
        addressId: testCustomer.addresses[0]._id,
        paymentId: p2._id,
        idempotencyKey: 'same-idemp-key-100',
      });

      expect(String(order1._id)).toBe(String(order2._id));
      expect(order1.orderNo).toBe(order2.orderNo);

      const count = await Order.countDocuments({
        customer: testCustomer._id,
        idempotencyKey: 'same-idemp-key-100',
      });
      expect(count).toBe(1);
    });
  });

  describe('State Machine Transitions', () => {
    let baseOrder;

    beforeEach(async () => {
      const p = await Payment.create({
        user: testCustomer._id,
        method: 'COD',
        amount: 14000,
        status: 'SUCCESS',
      });

      baseOrder = await orderService.createOrder({
        user: testCustomer,
        storeId: testStore._id,
        items: [{ storeProductId: testStoreProduct._id, qty: 1 }],
        fulfilment: 'delivery',
        addressId: testCustomer.addresses[0]._id,
        paymentId: p._id,
        idempotencyKey: `idemp-${Date.now()}-${Math.random()}`,
      });
    });

    test('happy path: PLACED -> ACCEPTED -> PACKING -> READY -> OUT_FOR_DELIVERY -> DELIVERED passes', async () => {
      // 1. Store accepts
      let updated = await orderService.transition(baseOrder._id, ACCEPTED, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: PLACED,
      });
      expect(updated.status).toBe(ACCEPTED);

      // 2. Store packing
      updated = await orderService.transition(baseOrder._id, PACKING, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: ACCEPTED,
      });
      expect(updated.status).toBe(PACKING);

      // 3. Store ready
      updated = await orderService.transition(baseOrder._id, READY, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: PACKING,
      });
      expect(updated.status).toBe(READY);

      // 4. Store out for delivery
      updated = await orderService.transition(baseOrder._id, OUT_FOR_DELIVERY, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: READY,
      });
      expect(updated.status).toBe(OUT_FOR_DELIVERY);

      // 5. Store delivered
      updated = await orderService.transition(baseOrder._id, DELIVERED, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: OUT_FOR_DELIVERY,
      });
      expect(updated.status).toBe(DELIVERED);
      expect(updated.statusHistory).toHaveLength(6);
    });

    test('pickup order direct transition: READY -> DELIVERED passes', async () => {
      const pickupPayment = await Payment.create({
        user: testCustomer._id,
        method: 'COD',
        amount: 12000, // no delivery fee for pickup
        status: 'SUCCESS',
      });

      const pickupOrder = await orderService.createOrder({
        user: testCustomer,
        storeId: testStore._id,
        items: [{ storeProductId: testStoreProduct._id, qty: 1 }],
        fulfilment: 'pickup',
        paymentId: pickupPayment._id,
        idempotencyKey: `pickup-${Date.now()}`,
      });

      await orderService.transition(pickupOrder._id, ACCEPTED, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: PLACED,
      });
      await orderService.transition(pickupOrder._id, PACKING, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: ACCEPTED,
      });
      await orderService.transition(pickupOrder._id, READY, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: PACKING,
      });

      // READY -> DELIVERED direct transition for pickup
      const delivered = await orderService.transition(pickupOrder._id, DELIVERED, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: READY,
      });
      expect(delivered.status).toBe(DELIVERED);
    });

    test('store reject: PLACED -> REJECTED passes', async () => {
      const rejected = await orderService.transition(baseOrder._id, REJECTED, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: PLACED,
        rejectReason: 'Item unavailable',
      });
      expect(rejected.status).toBe(REJECTED);
      expect(rejected.rejectReason).toBe('Item unavailable');
    });

    test('customer cancel: PLACED -> CANCELLED passes', async () => {
      const cancelled = await orderService.transition(baseOrder._id, CANCELLED, {
        actor: testCustomer,
        role: 'customer',
        expectedStatus: PLACED,
        note: 'Ordered by mistake',
      });
      expect(cancelled.status).toBe(CANCELLED);
    });

    test('system timeout: PLACED -> EXPIRED passes', async () => {
      const expired = await orderService.transition(baseOrder._id, EXPIRED, {
        actor: null,
        role: 'system',
        expectedStatus: PLACED,
        note: 'Store response timed out',
      });
      expect(expired.status).toBe(EXPIRED);
    });

    test('item adjustment flow: ACCEPTED -> AWAITING_CUSTOMER -> PACKING passes', async () => {
      await orderService.transition(baseOrder._id, ACCEPTED, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: PLACED,
      });

      const awaiting = await orderService.transition(baseOrder._id, AWAITING_CUSTOMER, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: ACCEPTED,
        note: 'Sugar 1kg out of stock',
      });
      expect(awaiting.status).toBe(AWAITING_CUSTOMER);

      // Customer accepts replacement
      const confirmed = await orderService.transition(baseOrder._id, PACKING, {
        actor: testCustomer,
        role: 'customer',
        expectedStatus: AWAITING_CUSTOMER,
        note: 'Customer approved changes',
      });
      expect(confirmed.status).toBe(PACKING);
    });

    test('invalid transition or mismatched expectedStatus returns 409', async () => {
      // Trying to transition with expectedStatus ACCEPTED when order is currently PLACED
      await expect(
        orderService.transition(baseOrder._id, PACKING, {
          actor: testStoreOwner,
          role: 'store',
          expectedStatus: ACCEPTED, // mismatch
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'STATUS_CONFLICT',
      });
    });

    test('terminal status cannot be changed', async () => {
      await orderService.transition(baseOrder._id, REJECTED, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: PLACED,
      });

      await expect(
        orderService.transition(baseOrder._id, ACCEPTED, {
          actor: testStoreOwner,
          role: 'store',
          expectedStatus: REJECTED,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'TERMINAL_STATUS',
      });
    });

    test('double accept of the same order: only one wins and the second returns 409', async () => {
      // Execute two concurrent transitions expecting PLACED
      const results = await Promise.allSettled([
        orderService.transition(baseOrder._id, ACCEPTED, {
          actor: testStoreOwner,
          role: 'store',
          expectedStatus: PLACED,
        }),
        orderService.transition(baseOrder._id, ACCEPTED, {
          actor: testStoreOwner,
          role: 'store',
          expectedStatus: PLACED,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.statusCode).toBe(409);
      expect(rejected[0].reason.code).toBe('STATUS_CONFLICT');
    });
  });
});
