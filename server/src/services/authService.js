const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET, ADMIN_USER_ID, ADMIN_PASSWORD } = require('../config/env');
const User = require('../models/User');
const { ADMIN, STORE_OWNER, CUSTOMER } = require('../constants/roles');
const AppError = require('../utils/AppError');

const isProduction = () => process.env.NODE_ENV === 'production';

const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: isProduction() ? 'none' : 'lax',
  secure: isProduction(),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

const sendTokenCookie = (res, user) => {
  const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  res.cookie('token', token, getCookieOptions());
  return token;
};

const clearTokenCookie = (res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: isProduction() ? 'none' : 'lax',
    secure: isProduction(),
  });
};

const hashPassword = async (password) => {
  return bcrypt.hash(password, 10);
};

const verifyPassword = async (password, hash) => {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
};

const signup = async ({ name, username, password, phone, role }) => {
  if (role !== CUSTOMER && role !== STORE_OWNER) {
    throw new AppError(400, 'INVALID_ROLE', 'Role must be customer or store_owner');
  }

  const normalizedUsername = (username || '').toLowerCase().trim();
  const existingUser = await User.findOne({ username: normalizedUsername });
  if (existingUser) {
    throw new AppError(409, 'USERNAME_TAKEN', 'Username is already taken');
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name: name.trim(),
    username: normalizedUsername,
    passwordHash,
    phone: phone ? phone.trim() : '',
    role,
  });

  return user;
};

const login = async ({ username, password, role }) => {
  const normalizedUsername = (username || '').toLowerCase().trim();
  const user = await User.findOne({ username: normalizedUsername }).select('+passwordHash');

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  const isMatch = await verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  if (user.isBlocked) {
    throw new AppError(403, 'ACCOUNT_BLOCKED', 'Your account has been suspended');
  }

  // Admin accounts can NEVER log in through this function
  if (user.role === ADMIN) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  // Account role must match the requested role (e.g. customer toggle vs store_owner account)
  if (user.role !== role) {
    throw new AppError(403, 'ROLE_MISMATCH', 'Account role does not match selected role');
  }

  return user;
};

const adminLogin = async ({ username, password }) => {
  const normalizedUsername = (username || '').toLowerCase().trim();
  const user = await User.findOne({ username: normalizedUsername }).select('+passwordHash');

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  const isMatch = await verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  if (user.isBlocked) {
    throw new AppError(403, 'ACCOUNT_BLOCKED', 'Your account has been suspended');
  }

  if (user.role !== ADMIN) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  return user;
};

const ensureAdminAccount = async () => {
  try {
    if (!ADMIN_USER_ID || !ADMIN_PASSWORD) {
      console.warn('[Admin] ADMIN_USER_ID or ADMIN_PASSWORD missing, skipping admin account provisioning');
      return;
    }

    const normalizedUsername = ADMIN_USER_ID.toLowerCase().trim();
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    let admin = await User.findOne({ username: normalizedUsername });
    if (!admin) {
      admin = await User.create({
        username: normalizedUsername,
        name: 'Platform Admin',
        role: ADMIN,
        passwordHash,
        phone: '9999999999',
      });
      console.log(`[Admin] Provisioned initial admin user: ${normalizedUsername}`);
    } else {
      admin.name = 'Platform Admin';
      admin.role = ADMIN;
      admin.passwordHash = passwordHash;
      admin.isBlocked = false;
      await admin.save();
      console.log(`[Admin] Updated admin user: ${normalizedUsername}`);
    }
  } catch (err) {
    console.error('[Admin] Error ensuring admin account:', err.message);
  }
};

const demoLogin = async (role) => {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError(403, 'FORBIDDEN', 'Demo login is disabled in production');
  }

  const validRoles = [CUSTOMER, STORE_OWNER, ADMIN, 'new_store_owner'];
  if (!validRoles.includes(role)) {
    throw new AppError(400, 'INVALID_ROLE', `Role must be one of: ${validRoles.join(', ')}`);
  }

  const demoAccounts = {
    [CUSTOMER]: {
      username: 'demo_customer',
      name: 'Demo Customer',
      role: CUSTOMER,
      phone: '9999999999',
    },
    [STORE_OWNER]: {
      username: 'demo_store',
      name: 'ikshara (Store Owner)',
      role: STORE_OWNER,
      phone: '9999999999',
    },
    new_store_owner: {
      username: 'demo_newstore',
      name: 'New Store Owner',
      role: STORE_OWNER,
      phone: '9848099999',
    },
    [ADMIN]: {
      username: 'demo_admin',
      name: 'Demo Admin',
      role: ADMIN,
      phone: '9999999999',
    },
  };

  const accountData = demoAccounts[role];

  let user = await User.findOne({ username: accountData.username });
  if (!user) {
    user = await User.create(accountData);
  } else {
    user.name = accountData.name;
    user.role = accountData.role;
    user.phone = accountData.phone;
    user.isBlocked = false;
    await user.save();
  }

  return user;
};

module.exports = {
  signup,
  login,
  adminLogin,
  ensureAdminAccount,
  demoLogin,
  sendTokenCookie,
  clearTokenCookie,
  hashPassword,
  verifyPassword,
};
