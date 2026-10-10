/* global describe, test, expect, beforeAll, afterAll, jest */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const Store = require('../src/models/Store');
const StoreProduct = require('../src/models/StoreProduct');
const Payment = require('../src/models/Payment');
const Counter = require('../src/models/Counter');
const User = require('../src/models/User');
const paymentService = require('../src/services/paymentService');
const orderService = require('../src/services/orderService');
const { PLACED, REJECTED, CANCELLED } = require('../src/constants/orderStatus');

describe('Step 10: Payment Service & Mock Refunds Tests', () => {
  jest.setTimeout(30000);

  let testUser;
  let testStoreOwner;
  let testStore;
  let testProduct;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGO_URI_TEST ||
      process.env.MONGO_URI ||
      'mongodb://127.0.0.1:27017/kirana_test_db';

    await mongoose.connect(mongoUri, {
      dbName: 'kirana_test_payments',
    });

    await Promise.all([
      Order.deleteMany({}),
      Store.deleteMany({}),
      StoreProduct.deleteMany({}),
      Payment.deleteMany({}),
      Counter.deleteMany({}),
      User.deleteMany({}),
    ]);

    testUser = await User.create({
      name: 'Payment Tester',
      email: 'paytester@test.com',
      role: 'customer',
      phone: '9988776655',
      addresses: [
        {
          label: 'Home',
          line: 'Gudlavalleru Main Bazaar',
          pincode: '521356',
          location: { type: 'Point', coordinates: [81.05, 16.34] },
          isDefault: true,
        },
      ],
    });

    testStoreOwner = await User.create({
      name: 'Store Owner Pay',
      email: 'storepay@test.com',
      role: 'store_owner',
      phone: '9988776644',
    });

    testStore = await Store.create({
      owner: testStoreOwner._id,
      name: 'Super Kirana',
      slug: 'super-kirana',
      phone: '9988776644',
      address: 'Main Road Gudlavalleru',
      pincode: '521356',
      location: { type: 'Point', coordinates: [81.05, 16.34] },
      status: 'approved',
      isOpen: true,
      timings: { open: '00:00', close: '23:59' },
      deliveryRadiusKm: 5,
      deliveryFee: 2000,
      freeDeliveryAbove: 30000,
      minOrder: 1000,
      supportsDelivery: true,
      supportsPickup: true,
    });

    testProduct = await StoreProduct.create({
      store: testStore._id,
      customName: 'Sunflower Oil 1L',
      price: 15000, // ₹150
      mrp: 18000,
      inStock: true,
      isActive: true,
    });
  });

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

  describe('1. COD Payment Rules', () => {
    test('COD succeeds immediately for amounts <= ₹2,000 (200,000 paise)', async () => {
      const payment = await paymentService.initiate({
        method: 'COD',
        userId: testUser._id,
        amount: 50000, // ₹500
      });
      expect(payment.status).toBe('SUCCESS');
      expect(payment.amount).toBe(50000);
      expect(payment.method).toBe('COD');
    });

    test('COD rejects when total exceeds ₹2,000 (200,000 paise)', async () => {
      await expect(
        paymentService.initiate({
          method: 'COD',
          userId: testUser._id,
          amount: 250000, // ₹2,500
        }),
      ).rejects.toThrow('Cash on Delivery is not allowed for orders above ₹2,000');
    });
  });

  describe('2. Card Payment Flows', () => {
    test('Card initiate creates PENDING payment; confirm with valid card succeeds', async () => {
      const payment = await paymentService.initiate({
        method: 'CARD',
        userId: testUser._id,
        amount: 15000,
      });
      expect(payment.status).toBe('PENDING');

      const confirmed = await paymentService.confirm({
        paymentId: payment._id,
        userId: testUser._id,
        details: { brand: 'Visa', last4: '1111' },
      });
      expect(confirmed.status).toBe('SUCCESS');
      expect(confirmed.last4).toBe('1111');
      expect(confirmed.brand).toBe('Visa');
    });

    test('Card confirm with last4 "0002" fails with "Payment declined by bank"', async () => {
      const payment = await paymentService.initiate({
        method: 'CARD',
        userId: testUser._id,
        amount: 15000,
      });

      await expect(
        paymentService.confirm({
          paymentId: payment._id,
          userId: testUser._id,
          details: { brand: 'Visa', last4: '0002' },
        }),
      ).rejects.toThrow('Payment declined by bank');

      const updated = await Payment.findById(payment._id);
      expect(updated.status).toBe('FAILED');
    });
  });

  describe('3. UPI Payment Flows', () => {
    test('UPI initiate creates PENDING payment; confirm with valid ID succeeds', async () => {
      const payment = await paymentService.initiate({
        method: 'UPI',
        userId: testUser._id,
        amount: 20000,
      });
      expect(payment.status).toBe('PENDING');

      const confirmed = await paymentService.confirm({
        paymentId: payment._id,
        userId: testUser._id,
        details: { upiId: 'customer@okhdfcbank' },
      });
      expect(confirmed.status).toBe('SUCCESS');
      expect(confirmed.upiId).toBe('customer@okhdfcbank');
    });

    test('UPI ID containing "fail" fails upon confirm', async () => {
      const payment = await paymentService.initiate({
        method: 'UPI',
        userId: testUser._id,
        amount: 20000,
      });

      await expect(
        paymentService.confirm({
          paymentId: payment._id,
          userId: testUser._id,
          details: { upiId: 'failuser@oksbi' },
        }),
      ).rejects.toThrow('UPI payment failed');

      const updated = await Payment.findById(payment._id);
      expect(updated.status).toBe('FAILED');
    });

    test('UPI cancel marks PENDING payment as CANCELLED', async () => {
      const payment = await paymentService.initiate({
        method: 'UPI',
        userId: testUser._id,
        amount: 20000,
      });

      const cancelled = await paymentService.cancel({
        paymentId: payment._id,
        userId: testUser._id,
      });
      expect(cancelled.status).toBe('CANCELLED');
    });
  });

  describe('4. Prepaid Order Refunds', () => {
    test('Prepaid order rejected by store triggers full mock refund', async () => {
      // 1. Create and confirm Card payment
      const payment = await paymentService.initiate({
        method: 'CARD',
        userId: testUser._id,
        storeId: testStore._id,
        items: [{ storeProductId: testProduct._id, qty: 1 }],
      });

      await paymentService.confirm({
        paymentId: payment._id,
        userId: testUser._id,
        details: { brand: 'Visa', last4: '1111' },
      });

      // 2. Create Order
      const order = await orderService.createOrder({
        user: testUser,
        storeId: testStore._id,
        items: [{ storeProductId: testProduct._id, qty: 1 }],
        fulfilment: 'delivery',
        addressId: testUser.addresses[0]._id,
        paymentId: payment._id,
        idempotencyKey: `pay-test-refund-${Date.now()}`,
      });
      expect(order.status).toBe(PLACED);
      expect(order.paymentStatus).toBe('SUCCESS');

      // 3. Store rejects order
      const rejectedOrder = await orderService.transition(order._id, REJECTED, {
        actor: testStoreOwner,
        role: 'store',
        expectedStatus: PLACED,
        rejectReason: 'Out of stock at store',
      });

      expect(rejectedOrder.status).toBe(REJECTED);
      expect(rejectedOrder.paymentStatus).toBe('REFUNDED');
      expect(rejectedOrder.refundAmount).toBe(rejectedOrder.total);

      const updatedPayment = await Payment.findById(payment._id);
      expect(updatedPayment.status).toBe('REFUNDED');
      expect(updatedPayment.refundAmount).toBe(rejectedOrder.total);
    });

    test('Prepaid order cancelled by customer triggers full mock refund', async () => {
      const payment = await paymentService.initiate({
        method: 'UPI',
        userId: testUser._id,
        storeId: testStore._id,
        items: [{ storeProductId: testProduct._id, qty: 1 }],
      });

      await paymentService.confirm({
        paymentId: payment._id,
        userId: testUser._id,
        details: { upiId: 'buyer@ybl' },
      });

      const order = await orderService.createOrder({
        user: testUser,
        storeId: testStore._id,
        items: [{ storeProductId: testProduct._id, qty: 1 }],
        fulfilment: 'delivery',
        addressId: testUser.addresses[0]._id,
        paymentId: payment._id,
        idempotencyKey: `pay-test-cancel-${Date.now()}`,
      });

      const cancelledOrder = await orderService.transition(order._id, CANCELLED, {
        actor: testUser,
        role: 'customer',
        expectedStatus: PLACED,
        note: 'Customer changed mind',
      });

      expect(cancelledOrder.status).toBe(CANCELLED);
      expect(cancelledOrder.paymentStatus).toBe('REFUNDED');
      expect(cancelledOrder.refundAmount).toBe(cancelledOrder.total);
    });
  });
});
