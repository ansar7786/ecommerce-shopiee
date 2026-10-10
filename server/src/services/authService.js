const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { GOOGLE_CLIENT_ID, ADMIN_EMAILS, JWT_SECRET, NODE_ENV } = require('../config/env');
const User = require('../models/User');
const { ADMIN, STORE_OWNER, CUSTOMER } = require('../constants/roles');
const AppError = require('../utils/AppError');

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const sendTokenCookie = (res, user) => {
  const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  res.cookie('token', token, COOKIE_OPTIONS);
  return token;
};

const clearTokenCookie = (res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: NODE_ENV === 'production',
  });
};

const verifyGoogleToken = async (credential) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
  } catch (_error) {
    throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Google authentication failed: invalid token');
  }
};

const loginWithGoogle = async ({ credential, intent }) => {
  const payload = await verifyGoogleToken(credential);
  const { sub: googleId, email, name, picture } = payload;

  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail) {
    throw new AppError(400, 'INVALID_INPUT', 'Google account did not provide an email address');
  }

  let user = await User.findOne({
    $or: [{ googleId }, { email: normalizedEmail }],
  });

  if (user) {
    if (user.isBlocked) {
      throw new AppError(403, 'ACCOUNT_BLOCKED', 'Your account has been suspended');
    }

    let modified = false;
    if (!user.googleId) {
      user.googleId = googleId;
      modified = true;
    }
    if (!user.photo && picture) {
      user.photo = picture;
      modified = true;
    }
    if (modified) {
      await user.save();
    }
    return user;
  }

  // New user role determination
  let assignedRole = CUSTOMER;
  if (ADMIN_EMAILS.includes(normalizedEmail)) {
    assignedRole = ADMIN;
  } else if (intent === 'store') {
    assignedRole = STORE_OWNER;
  }

  user = await User.create({
    googleId,
    email: normalizedEmail,
    name: name || 'User',
    photo: picture || '',
    role: assignedRole,
  });

  return user;
};

const demoLogin = async (role) => {
  if (NODE_ENV === 'production') {
    throw new AppError(403, 'FORBIDDEN', 'Demo login is disabled in production');
  }

  const validRoles = [CUSTOMER, STORE_OWNER, ADMIN, 'new_store_owner'];
  if (!validRoles.includes(role)) {
    throw new AppError(400, 'INVALID_ROLE', `Role must be one of: ${validRoles.join(', ')}`);
  }

  const demoAccounts = {
    [CUSTOMER]: {
      email: 'customer@demo.com',
      name: 'Demo Customer',
      role: CUSTOMER,
      phone: '9999999999',
    },
    [STORE_OWNER]: {
      email: 'store@demo.com',
      name: 'ikshara (Store Owner)',
      role: STORE_OWNER,
      phone: '9999999999',
    },
    new_store_owner: {
      email: 'newstore@demo.com',
      name: 'New Store Owner',
      role: STORE_OWNER,
      phone: '9848099999',
    },
    [ADMIN]: {
      email: 'admin@demo.com',
      name: 'Demo Admin',
      role: ADMIN,
      phone: '9999999999',
    },
  };

  const accountData = demoAccounts[role];

  let user = await User.findOne({ email: accountData.email });
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
  loginWithGoogle,
  demoLogin,
  sendTokenCookie,
  clearTokenCookie,
};
