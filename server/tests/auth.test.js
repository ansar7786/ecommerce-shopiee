/* global describe, test, expect, beforeAll, afterAll, jest */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const authService = require('../src/services/authService');

describe('Username + Password Authentication Tests', () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGO_URI_TEST ||
      process.env.MONGO_URI ||
      'mongodb://127.0.0.1:27017/kirana_test_db';

    await mongoose.connect(mongoUri, {
      dbName: 'kirana_test_auth',
    });

    await User.deleteMany({});
    await User.syncIndexes();
    await authService.ensureAdminAccount();
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  test('1. signup creates a customer, sets the cookie, and does not return passwordHash', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'New Customer',
        username: 'test_cust',
        password: 'password123',
        phone: '9848012345',
        role: 'customer',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.username).toBe('test_cust');
    expect(res.body.user.role).toBe('customer');
    expect(res.body.user.passwordHash).toBeUndefined();

    // Check cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('token='))).toBe(true);
  });

  test('2. signup with role "admin" is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Malicious Admin',
        username: 'fake_admin',
        password: 'password123',
        phone: '9848012346',
        role: 'admin',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('3. duplicate username -> 409 USERNAME_TAKEN', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Duplicate Guy',
        username: 'test_cust',
        password: 'password123',
        phone: '9848012347',
        role: 'customer',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USERNAME_TAKEN');
  });

  test('4. login success, wrong password -> 401 generic, unknown user -> 401 generic', async () => {
    // 4a. Success
    const successRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'test_cust',
        password: 'password123',
        role: 'customer',
      });

    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);
    expect(successRes.body.user.username).toBe('test_cust');
    expect(successRes.body.user.passwordHash).toBeUndefined();
    expect(successRes.headers['set-cookie']).toBeDefined();

    // 4b. Wrong password -> 401 generic
    const wrongPassRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'test_cust',
        password: 'wrong_password',
        role: 'customer',
      });

    expect(wrongPassRes.status).toBe(401);
    expect(wrongPassRes.body.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassRes.body.message).toBe('Invalid username or password');

    // 4c. Unknown user -> 401 generic
    const unknownUserRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'nonexistent_user',
        password: 'somepassword',
        role: 'customer',
      });

    expect(unknownUserRes.status).toBe(401);
    expect(unknownUserRes.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknownUserRes.body.message).toBe('Invalid username or password');
  });

  test('5. role mismatch -> 403 ROLE_MISMATCH', async () => {
    // Customer tries logging in with role 'store_owner'
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'test_cust',
        password: 'password123',
        role: 'store_owner',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROLE_MISMATCH');
  });

  test('6. blocked user login -> 403 ACCOUNT_BLOCKED', async () => {
    // Block user
    await User.updateOne({ username: 'test_cust' }, { isBlocked: true });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'test_cust',
        password: 'password123',
        role: 'customer',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_BLOCKED');

    // Unblock for cleanup
    await User.updateOne({ username: 'test_cust' }, { isBlocked: false });
  });

  test('7. admin cannot log in via /api/auth/login, and can via /api/auth/admin/login', async () => {
    // Try logging in as admin via normal /api/auth/login with customer role
    const normalLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123',
        role: 'customer',
      });

    expect([401, 403]).toContain(normalLoginRes.status);
    expect(normalLoginRes.body.success).toBe(false);

    // Logging in via /api/auth/admin/login
    const adminLoginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({
        username: 'admin',
        password: 'admin123',
      });

    expect(adminLoginRes.status).toBe(200);
    expect(adminLoginRes.body.success).toBe(true);
    expect(adminLoginRes.body.user.role).toBe('admin');
  });

  test('8. /api/auth/google no longer exists (404)', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({
        credential: 'some_google_jwt',
      });

    expect(res.status).toBe(404);
  });

  test('9. demo login still returns 403 when NODE_ENV=production', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      const auth = require('../src/services/authService');
      process.env.NODE_ENV = 'production';
      await expect(auth.demoLogin('customer')).rejects.toThrow('Demo login is disabled in production');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

