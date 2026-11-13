# Locart Platform - Comprehensive Authentication & Authorization Report
**File:** `AUTH_REPORT.md`  
**Generated:** 2026-11-13  
**Project:** Locart (Zero-Commission Kirana Commerce Platform - Gudlavalleru CSP Prototype)

---

## Table of Contents
1. [Server Auth, Login & User Files (Full File Contents)](#1-server-auth-login--user-files)
   - [`server/src/services/authService.js`](#serversrcservicesauthservicejs)
   - [`server/src/routes/authRoutes.js`](#serversrcroutesauthroutesjs)
   - [`server/src/controllers/authController.js`](#serversrccontrollersauthcontrollerjs)
   - [`server/src/middleware/auth.js`](#serversrcmiddlewareauthjs)
   - [`server/src/middleware/role.js`](#serversrcmiddlewarerolejs)
   - [`server/src/middleware/requireApprovedStore.js`](#serversrcmiddlewarerequireapprovedstorejs)
   - [`server/src/models/User.js`](#serversrcmodelsuserjs)
   - [`server/src/constants/roles.js`](#serversrcconstantsrolesjs)
   - [`server/src/routes/userRoutes.js`](#serversrcroutesuserroutesjs)
   - [`server/src/controllers/userController.js`](#serversrccontrollersusercontrollerjs)
2. [Client Auth, Login & Guard Files (Full File Contents)](#2-client-auth-login--guard-files)
   - [`client/src/pages/public/Login.jsx`](#clientsrcpagespublicloginjsx)
   - [`client/src/pages/public/CompleteProfile.jsx`](#clientsrcpagespubliccompleteprofilejsx)
   - [`client/src/context/AuthContext.jsx`](#clientsrccontextauthcontextjsx)
   - [`client/src/api/axios.js`](#clientsrcapiaxiosjs)
   - [`client/src/routes/ProtectedRoute.jsx`](#clientsrcroutesprotectedroutejsx)
   - [`client/src/routes/StoreGuard.jsx`](#clientsrcroutesstoreguardjsx)
   - [i18n Keys: `client/src/i18n/en.json` (Auth Namespace)](#i18n-keys-clientsrci18nenjson-auth-namespace)
   - [i18n Keys: `client/src/i18n/te.json` (Auth Namespace)](#i18n-keys-clientsrci18ntejson-auth-namespace)
3. [Seed Scripts Creating Users, Admins & Demo Accounts (Full File Contents)](#3-seed-scripts-creating-users-admins--demo-accounts)
   - [`server/seed/seedStores.js`](#serverseedseedstoresjs)
   - [`server/seed/seedDemo.js`](#serverseedseeddemojs)
   - [Dynamic Account Generation in `authService.js`](#dynamic-account-generation-in-authservicejs)
4. [Exhaustive Occurrences of "google", "oauth", and "GOOGLE_CLIENT"](#4-exhaustive-occurrences-of-google-oauth-and-google_client)
5. [Auth-Related Dependencies in `package.json`](#5-auth-related-dependencies-in-packagejson)
6. [Security & Role Test File (Full File Contents) & Google OAuth Removal Impact](#6-security--role-test-file--google-oauth-removal-impact)
   - [`server/tests/security.test.js`](#servertestssecuritytestjs)
   - [Google OAuth Removal Impact Analysis](#google-oauth-removal-impact-analysis)
7. [User Schema Fields, Store Linkage & Admin Approval Workflow](#7-user-schema-fields-store-linkage--admin-approval-workflow)
8. [Login Routes & Post-Login Views by Role](#8-login-routes--post-login-views-by-role)

---

## 1. Server Auth, Login & User Files

### `server/src/services/authService.js`
```javascript
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { GOOGLE_CLIENT_ID, ADMIN_EMAILS, JWT_SECRET, NODE_ENV } = require('../config/env');
const User = require('../models/User');
const { ADMIN, STORE_OWNER, CUSTOMER } = require('../constants/roles');
const AppError = require('../utils/AppError');

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const isProduction = NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
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
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
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
```

---

### `server/src/routes/authRoutes.js`
```javascript
const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts, please try again later',
  },
});

router.use(authLimiter);

router.post('/google', authController.googleLogin);
router.post('/demo', authController.demoLogin);
router.post('/logout', authController.logout);
router.get('/me', auth, authController.getMe);

module.exports = router;
```

---

### `server/src/controllers/authController.js`
```javascript
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const authService = require('../services/authService');

const googleLogin = asyncHandler(async (req, res, next) => {
  const { credential, intent } = req.body;

  if (!credential) {
    return next(new AppError(400, 'INVALID_INPUT', 'Google credential is required'));
  }

  const user = await authService.loginWithGoogle({ credential, intent });
  authService.sendTokenCookie(res, user);

  res.status(200).json({
    success: true,
    user,
  });
});

const demoLogin = asyncHandler(async (req, res, next) => {
  const { role } = req.body;

  if (!role) {
    return next(new AppError(400, 'INVALID_INPUT', 'Role is required for demo login'));
  }

  const user = await authService.demoLogin(role);
  authService.sendTokenCookie(res, user);

  res.status(200).json({
    success: true,
    user,
  });
});

const logout = asyncHandler(async (req, res) => {
  authService.clearTokenCookie(res);
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

module.exports = {
  googleLogin,
  demoLogin,
  logout,
  getMe,
};
```

---

### `server/src/middleware/auth.js`
```javascript
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const auth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication token missing'));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (_err) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }

  const user = await User.findById(decoded.userId);

  if (!user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'User not found'));
  }

  if (user.isBlocked) {
    return next(new AppError(403, 'ACCOUNT_BLOCKED', 'Your account has been suspended'));
  }

  req.user = user;
  next();
});

module.exports = auth;
```

---

### `server/src/middleware/role.js`
```javascript
const { CUSTOMER, STORE_OWNER } = require('../constants/roles');
const AppError = require('../utils/AppError');

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    // Customer routes must also allow store_owner
    const effectiveRoles = new Set(allowedRoles);
    if (effectiveRoles.has(CUSTOMER)) {
      effectiveRoles.add(STORE_OWNER);
    }

    if (!effectiveRoles.has(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Access denied for your role'));
    }

    next();
  };
};

module.exports = requireRole;
```

---

### `server/src/middleware/requireApprovedStore.js`
```javascript
const Store = require('../models/Store');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const requireApprovedStore = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  }

  const store = await Store.findOne({ owner: req.user._id, status: 'approved' });
  if (!store) {
    return next(
      new AppError(
        403,
        'STORE_NOT_APPROVED',
        'You must have an approved store to manage inventory and catalogue products',
      ),
    );
  }

  req.store = store;
  next();
});

module.exports = requireApprovedStore;
```

---

### `server/src/models/User.js`
```javascript
const mongoose = require('mongoose');
const { CUSTOMER, ROLES } = require('../constants/roles');

const addressSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home',
    },
    line: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    landmark: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      sparse: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    photo: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ROLES,
      default: CUSTOMER,
    },
    addresses: {
      type: [addressSchema],
      default: [],
    },
    language: {
      type: String,
      enum: ['en', 'te'],
      default: 'en',
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model('User', userSchema);

module.exports = User;
```

---

### `server/src/constants/roles.js`
```javascript
const CUSTOMER = 'customer';
const STORE_OWNER = 'store_owner';
const ADMIN = 'admin';

module.exports = {
  CUSTOMER,
  STORE_OWNER,
  ADMIN,
  ROLES: [CUSTOMER, STORE_OWNER, ADMIN],
};
```

---

### `server/src/routes/userRoutes.js`
```javascript
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
```

---

### `server/src/controllers/userController.js`
```javascript
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const authService = require('../services/authService');

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit number starting with 6-9')
      .optional(),
    language: z.enum(['en', 'te']).optional(),
  })
  .strict();

const updateMe = asyncHandler(async (req, res, next) => {
  const parseResult = updateProfileSchema.safeParse(req.body);

  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const { name, phone, language } = parseResult.data;

  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  if (language !== undefined) req.user.language = language;

  await req.user.save();

  res.status(200).json({
    success: true,
    user: req.user,
  });
});

const addressInputSchema = z.object({
  label: z.enum(['Home', 'Work', 'Other']).default('Home'),
  line: z.string().trim().min(3, 'Address line is required').max(300),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'PIN code must be a 6-digit number'),
  landmark: z.string().trim().max(100).optional().default(''),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDefault: z.boolean().optional(),
});

const updateAddressInputSchema = z.object({
  label: z.enum(['Home', 'Work', 'Other']).optional(),
  line: z.string().trim().min(3).max(300).optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'PIN code must be a 6-digit number')
    .optional(),
  landmark: z.string().trim().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/users/me/addresses
const getAddresses = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    addresses: req.user.addresses || [],
  });
});

// POST /api/users/me/addresses
const addAddress = asyncHandler(async (req, res, next) => {
  const parsed = addressInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const { label, line, pincode, landmark, latitude, longitude, isDefault } = parsed.data;

  const willBeDefault = isDefault || req.user.addresses.length === 0;

  if (willBeDefault) {
    req.user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
  }

  const newAddress = {
    label,
    line,
    pincode,
    landmark: landmark || '',
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    isDefault: willBeDefault,
  };

  req.user.addresses.push(newAddress);
  await req.user.save();

  const created = req.user.addresses[req.user.addresses.length - 1];

  res.status(201).json({
    success: true,
    message: 'Address added successfully',
    address: created,
    addresses: req.user.addresses,
  });
});

// PATCH /api/users/me/addresses/:addressId
const updateAddress = asyncHandler(async (req, res, next) => {
  const { addressId } = req.params;
  const parsed = updateAddressInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(', ');
    return next(new AppError(400, 'VALIDATION_ERROR', errorMsg));
  }

  const addr = req.user.addresses.id(addressId);
  if (!addr) {
    return next(new AppError(404, 'NOT_FOUND', 'Address not found'));
  }

  const { label, line, pincode, landmark, latitude, longitude, isDefault } = parsed.data;

  if (label !== undefined) addr.label = label;
  if (line !== undefined) addr.line = line;
  if (pincode !== undefined) addr.pincode = pincode;
  if (landmark !== undefined) addr.landmark = landmark;

  if (latitude !== undefined && longitude !== undefined) {
    addr.location = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };
  }

  if (isDefault === true) {
    req.user.addresses.forEach((item) => {
      item.isDefault = false;
    });
    addr.isDefault = true;
  }

  await req.user.save();

  res.status(200).json({
    success: true,
    message: 'Address updated successfully',
    address: addr,
    addresses: req.user.addresses,
  });
});

// DELETE /api/users/me/addresses/:addressId
const deleteAddress = asyncHandler(async (req, res, next) => {
  const { addressId } = req.params;

  const addr = req.user.addresses.id(addressId);
  if (!addr) {
    return next(new AppError(404, 'NOT_FOUND', 'Address not found'));
  }

  const wasDefault = addr.isDefault;
  req.user.addresses.pull(addressId);

  if (wasDefault && req.user.addresses.length > 0) {
    req.user.addresses[0].isDefault = true;
  }

  await req.user.save();

  res.status(200).json({
    success: true,
    message: 'Address deleted successfully',
    addresses: req.user.addresses,
  });
});

// DELETE /api/users/me (Soft delete)
const deleteMe = asyncHandler(async (req, res) => {
  const user = req.user;

  user.name = 'Deleted User';
  user.email = `deleted_${user._id}@deleted.local`;
  user.phone = '';
  user.googleId = undefined;
  user.isBlocked = true;
  user.addresses = [];

  await user.save();

  authService.clearTokenCookie(res);

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully',
  });
});

module.exports = {
  updateMe,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  deleteMe,
};
```

---

## 2. Client Auth, Login & Guard Files

### `client/src/pages/public/Login.jsx`
```jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { ShieldAlert, Store, User, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast, Button, Card, Badge } from '../../components/ui';
import { LanguageToggle } from '../../components/LanguageToggle';

export const Login = () => {
  const { t } = useTranslation();
  const { user, loginWithGoogle, demoLogin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [intent, setIntent] = useState('customer'); // 'customer' | 'store'
  const [demoOpen, setDemoOpen] = useState(true);
  const [demoLoading, setDemoLoading] = useState(null);

  const navigateUser = useCallback(
    (loggedInUser) => {
      if (!loggedInUser.phone && loggedInUser.role !== 'admin') {
        navigate('/complete-profile', { replace: true });
      } else if (loggedInUser.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (loggedInUser.role === 'store_owner') {
        navigate('/store/orders', { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (user) {
      navigateUser(user);
    }
  }, [user, navigateUser]);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const u = await loginWithGoogle(credentialResponse.credential, intent);
      showToast({ type: 'success', message: t('auth.loginSuccess') });
      navigateUser(u);
    } catch (err) {
      const code = err.response?.data?.code;
      const msg = code === 'ACCOUNT_BLOCKED' ? t('auth.accountBlocked') : t('auth.googleFailed');
      showToast({ type: 'error', message: msg });
    }
  };

  const handleDemoLogin = async (role) => {
    try {
      setDemoLoading(role);
      const u = await demoLogin(role);
      showToast({ type: 'success', message: t('auth.loginSuccess') });
      navigateUser(u);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Demo login failed' });
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col justify-between p-4 sm:p-6 antialiased">
      {/* Top bar with Language Toggle */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
            L
          </span>
          <span className="font-bold text-ink-900">{t('app.name')}</span>
        </div>
        <LanguageToggle />
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <Card className="text-center shadow-md">
          {/* Brand Logo & Header */}
          <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Store className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">{t('app.name')}</h1>
          <p className="text-sm text-ink-600 mt-1.5 mb-6 max-w-xs mx-auto">{t('auth.tagline')}</p>

          {intent === 'store' && (
            <div className="mb-4">
              <Badge variant="packing" className="px-3 py-1 text-xs">
                {t('auth.storeOwnerBadge')}
              </Badge>
            </div>
          )}

          {/* Google OAuth Login Button */}
          <div className="flex flex-col items-center justify-center min-h-[48px] my-3">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => showToast({ type: 'error', message: t('auth.googleFailed') })}
              useOneTap={false}
              theme="outline"
              size="large"
              text="continue_with"
              shape="rectangular"
              width="320"
            />
          </div>

          {/* Toggle Intent Link */}
          <div className="mt-5 pt-4 border-t border-ink-300/40">
            <button
              type="button"
              onClick={() => setIntent(intent === 'store' ? 'customer' : 'store')}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 underline underline-offset-4 transition-colors"
            >
              {intent === 'store' ? t('auth.customerPrompt') : t('auth.storeOwnerPrompt')}
            </button>
          </div>
        </Card>

        {/* Dev-only Demo Login Panel */}
        {import.meta.env.DEV && (
          <div className="mt-6">
            <div className="bg-white rounded-card border border-ink-300/80 p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setDemoOpen(!demoOpen)}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-ink-600 hover:text-ink-900"
              >
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-accent-500" />
                  <span>{t('auth.demoLoginTitle')}</span>
                </div>
                {demoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {demoOpen && (
                <div className="mt-4 space-y-2.5">
                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-sm font-semibold justify-start px-4"
                    leftIcon={User}
                    loading={demoLoading === 'customer'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('customer')}
                  >
                    {t('auth.demoCustomer')}
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-sm font-semibold justify-start px-4"
                    leftIcon={Store}
                    loading={demoLoading === 'store_owner'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('store_owner')}
                  >
                    Store Owner (ikshara - Approved)
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-sm font-semibold justify-start px-4"
                    leftIcon={Store}
                    loading={demoLoading === 'new_store_owner'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('new_store_owner')}
                  >
                    New Store Owner (Test 4-Step Registration)
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-sm font-semibold justify-start px-4"
                    leftIcon={Shield}
                    loading={demoLoading === 'admin'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('admin')}
                  >
                    {t('auth.demoAdmin')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-xs text-ink-600">
        &copy; {new Date().getFullYear()} Locart. CSP Prototype.
      </footer>
    </div>
  );
};
```

---

### `client/src/pages/public/CompleteProfile.jsx`
```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Phone, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { Button, Input, Card, useToast } from '../../components/ui';
import { LanguageToggle } from '../../components/LanguageToggle';

export const CompleteProfile = () => {
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [phoneError, setPhoneError] = useState('');
  const [language, setLanguage] = useState(
    user?.language ||
      (typeof window !== 'undefined' ? localStorage.getItem('kirana_language') : null) ||
      'en',
  );

  // OTP mock flow: 'input_phone' | 'otp_sent' | 'verified'
  const [otpStep, setOtpStep] = useState(user?.phone ? 'verified' : 'input_phone');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validatePhone = (number) => {
    return /^[6-9]\d{9}$/.test(number.trim());
  };

  const handleSendOtp = () => {
    setPhoneError('');
    if (!validatePhone(phone)) {
      setPhoneError(t('auth.invalidPhone'));
      return;
    }
    setOtpStep('otp_sent');
    showToast({
      type: 'info',
      message: `${t('auth.otpHint')}`,
    });
  };

  const handleVerifyOtp = () => {
    setOtpError('');
    if (otpCode.trim() !== '123456') {
      setOtpError(t('auth.invalidOtp'));
      return;
    }
    setOtpStep('verified');
    showToast({
      type: 'success',
      message: 'Mobile number verified successfully!',
    });
  };

  const handleSelectLanguage = (lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kirana_language', lang);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ type: 'error', message: 'Name cannot be empty' });
      return;
    }

    if (otpStep !== 'verified') {
      showToast({ type: 'error', message: 'Please verify your phone number with OTP first' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.patch('/users/me', {
        name: name.trim(),
        phone: phone.trim(),
        language,
      });

      if (res.data?.success) {
        const updated = await refreshUser();
        showToast({ type: 'success', message: 'Profile updated successfully!' });

        if (updated?.role === 'store_owner') {
          navigate('/store/orders', { replace: true });
        } else if (updated?.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/app', { replace: true });
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update profile';
      showToast({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col justify-between p-4 sm:p-6 antialiased">
      {/* Top Header */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary-600 text-white font-bold flex items-center justify-center shadow-sm">
            K
          </span>
          <span className="font-bold text-ink-900">{t('app.name')}</span>
        </div>
        <LanguageToggle />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <Card className="shadow-md">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <UserCheck className="w-7 h-7 stroke-[2.2]" />
          </div>

          <h1 className="text-2xl font-bold text-ink-900 text-center tracking-tight">
            {t('auth.completeProfileTitle')}
          </h1>
          <p className="text-xs text-ink-600 text-center mt-1 mb-6">
            {t('auth.completeProfileDesc')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5 text-left">
            {/* Name Input */}
            <Input
              label={t('auth.fullName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />

            {/* Mobile & OTP Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-900">{t('auth.mobileNumber')}</label>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (otpStep === 'verified') setOtpStep('input_phone');
                    }}
                    placeholder="10-digit mobile number"
                    leftIcon={Phone}
                    disabled={otpStep === 'verified'}
                    error={phoneError}
                    maxLength={10}
                  />
                </div>

                {otpStep === 'input_phone' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="whitespace-nowrap px-3 text-sm font-semibold"
                    onClick={handleSendOtp}
                  >
                    {t('auth.sendOtp')}
                  </Button>
                )}

                {otpStep === 'verified' && (
                  <div className="h-12 min-h-[48px] px-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 text-xs font-bold">
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Verified</span>
                  </div>
                )}
              </div>

              {/* OTP Input Step */}
              {otpStep === 'otp_sent' && (
                <div className="mt-3 p-3.5 bg-page rounded-xl border border-ink-300/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-900">{t('auth.enterOtp')}</span>
                    <span className="text-[11px] text-ink-600 font-mono">Mock OTP: 123456</span>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        error={otpError}
                      />
                    </div>
                    <Button type="button" variant="primary" size="md" onClick={handleVerifyOtp}>
                      Verify
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Language Preference - Two Big Cards */}
            <div className="space-y-2 pt-1">
              <label className="text-sm font-medium text-ink-900 block">
                {t('auth.preferredLanguage')}
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* English Card */}
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('en')}
                  className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between min-h-[84px] select-none ${
                    language === 'en'
                      ? 'border-primary-600 bg-primary-50/60 shadow-sm'
                      : 'border-ink-300/60 bg-white hover:border-ink-300 hover:bg-page'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-bold text-ink-900">English</span>
                    {language === 'en' && (
                      <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-ink-600 mt-1">Default language</span>
                </button>

                {/* Telugu Card */}
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('te')}
                  className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between min-h-[84px] select-none ${
                    language === 'te'
                      ? 'border-primary-600 bg-primary-50/60 shadow-sm'
                      : 'border-ink-300/60 bg-white hover:border-ink-300 hover:bg-page'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-base font-bold text-ink-900 font-sans lang-te">
                      తెలుగు
                    </span>
                    {language === 'te' && (
                      <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-ink-600 mt-1">ప్రాంతీయ భాష</span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={submitting}
                rightIcon={ShieldCheck}
              >
                {t('common.save')}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-xs text-ink-600">
        &copy; {new Date().getFullYear()} Locart.
      </footer>
    </div>
  );
};
```

---

### `client/src/context/AuthContext.jsx`
```jsx
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import i18n from '../i18n';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyUserLanguage = (userObj) => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('kirana_language') : null;
    const targetLang = saved || userObj?.language || 'en';
    if (i18n.language !== targetLang) {
      i18n.changeLanguage(targetLang);
    }
  };

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success && res.data?.user) {
        setUser(res.data.user);
        applyUserLanguage(res.data.user);
        return res.data.user;
      }
      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithGoogle = async (credential, intent = 'customer') => {
    const res = await api.post('/auth/google', { credential, intent });
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
      applyUserLanguage(res.data.user);
      return res.data.user;
    }
    throw new Error('Google login failed');
  };

  const demoLogin = async (role) => {
    const res = await api.post('/auth/demo', { role });
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
      applyUserLanguage(res.data.user);
      return res.data.user;
    }
    throw new Error('Demo login failed');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        demoLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

---

### `client/src/api/axios.js`
```javascript
import axios from 'axios';

const apiBase = import.meta.env.VITE_API_URL;
const baseURL = apiBase
  ? apiBase.endsWith('/api')
    ? apiBase
    : `${apiBase.replace(/\/+$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
});

export default api;
```

---

### `client/src/routes/ProtectedRoute.jsx`
```jsx
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/ui/Skeleton';

export const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-3/4 rounded-xl" />
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Profile completion check for non-admin users
  if (!user.phone && user.role !== 'admin' && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const effectiveRoles = new Set(allowedRoles);
    // Customer routes also allow store_owner
    if (effectiveRoles.has('customer')) {
      effectiveRoles.add('store_owner');
    }

    if (!effectiveRoles.has(user.role)) {
      if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
      if (user.role === 'store_owner') return <Navigate to="/store/orders" replace />;
      return <Navigate to="/app" replace />;
    }
  }

  return children ? children : <Outlet />;
};
```

---

### `client/src/routes/StoreGuard.jsx`
```jsx
import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export const StoreGuard = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const checkStore = async () => {
      try {
        const res = await api.get('/stores/me');
        if (isMounted) {
          setStore(res.data.store || null);
        }
      } catch {
        if (isMounted) {
          setStore(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (user && user.role === 'store_owner') {
      checkStore();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user, location.pathname]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-ink-600">Verifying store access...</span>
      </div>
    );
  }

  const path = location.pathname;

  // Case 1: No store registered yet
  if (!store) {
    if (path === '/store/register') {
      return children || <Outlet />;
    }
    return <Navigate to="/store/register" replace />;
  }

  // Case 2: Store is pending review
  if (store.status === 'pending') {
    if (path === '/store/pending') {
      return children || <Outlet />;
    }
    return <Navigate to="/store/pending" replace />;
  }

  // Case 3: Store was rejected
  if (store.status === 'rejected') {
    if (path === '/store/pending' || path === '/store/register') {
      return children || <Outlet />;
    }
    return <Navigate to="/store/pending" replace />;
  }

  // Case 4: Store is suspended
  if (store.status === 'suspended') {
    if (path === '/store/pending') {
      return children || <Outlet />;
    }
    return <Navigate to="/store/pending" replace />;
  }

  // Case 5: Store is approved
  if (store.status === 'approved') {
    const isEditMode = location.search.includes('edit=true');
    // If approved, don't stay on register or pending screens unless editing
    if (
      (path === '/store/register' && !isEditMode) ||
      path === '/store/pending' ||
      path === '/store'
    ) {
      if ((store.productCount ?? 0) < 10) {
        return <Navigate to="/store/products/add" replace />;
      }
      return <Navigate to="/store/orders" replace />;
    }

    // Redirect an approved store with fewer than 10 products to S3 from /store/orders
    if (path === '/store/orders' && (store.productCount ?? 0) < 10) {
      return <Navigate to="/store/products/add" replace />;
    }

    return children || <Outlet />;
  }

  return children || <Outlet />;
};

StoreGuard.propTypes = {
  children: PropTypes.node,
};
```

---

### i18n Keys: `client/src/i18n/en.json` (Auth Namespace)
```json
  "auth": {
    "tagline": "Zero-commission neighbourhood grocery delivery",
    "continueWithGoogle": "Continue with Google",
    "storeOwnerPrompt": "I'm a store owner",
    "customerPrompt": "Switch to Customer sign in",
    "storeOwnerBadge": "Store Owner Registration / Sign In",
    "demoLoginTitle": "Demo Login (Dev Only)",
    "demoCustomer": "Login as Customer",
    "demoStore": "Login as Store Owner",
    "demoAdmin": "Login as Admin",
    "accountBlocked": "Your account has been suspended. Please contact support.",
    "googleFailed": "Google sign-in was cancelled or blocked. Please try again.",
    "loginSuccess": "Logged in successfully!",
    "logout": "Logout",
    "completeProfileTitle": "Complete Your Profile",
    "completeProfileDesc": "Verify your mobile number and select your preferred language",
    "fullName": "Full Name",
    "mobileNumber": "Mobile Number",
    "sendOtp": "Send OTP",
    "enterOtp": "Enter 6-Digit OTP",
    "verifyOtp": "Verify & Save",
    "preferredLanguage": "Preferred Language",
    "otpHint": "Enter 123456 to verify (demo OTP)",
    "invalidOtp": "Invalid OTP. Please enter 123456.",
    "invalidPhone": "Please enter a valid 10-digit Indian phone number starting with 6-9."
  }
```

---

### i18n Keys: `client/src/i18n/te.json` (Auth Namespace)
```json
  "auth": {
    "tagline": "జీరో-కమిషన్ సమీప కిరాణా సరుకుల డెలివరీ",
    "continueWithGoogle": "Google తో కొనసాగండి",
    "storeOwnerPrompt": "నేను స్టోర్ యజమానిని",
    "customerPrompt": "కస్టమర్ లాగిన్‌కు మారండి",
    "storeOwnerBadge": "స్టోర్ యజమాని నమోదు / లాగిన్",
    "demoLoginTitle": "డెమో లాగిన్ (డెవలప్‌మెంట్ మాత్రమే)",
    "demoCustomer": "కస్టమర్‌గా లాగిన్ అవ్వండి",
    "demoStore": "స్టోర్ యజమానిగా లాగిన్ అవ్వండి",
    "demoAdmin": "అడ్మిన్‌గా లాగిన్ అవ్వండి",
    "accountBlocked": "మీ ఖాతా తాత్కాలికంగా నిలిపివేయబడింది. దయచేసి మద్దతు బృందాన్ని సంప్రదించండి.",
    "googleFailed": "Google సైన్-ఇన్ విఫలమైంది లేదా రద్దు చేయబడింది. దయచేసి మళ్లీ ప్రయత్నించండి.",
    "loginSuccess": "విజయవంతంగా లాగిన్ అయ్యారు!",
    "logout": "లాగౌట్",
    "completeProfileTitle": "మీ ప్రొఫైల్‌ను పూర్తి చేయండి",
    "completeProfileDesc": "మీ మొబైల్ నంబర్‌ను ధృవీకరించండి మరియు మీకు నచ్చిన భాషను ఎంచుకోండి",
    "fullName": "పూర్తి పేరు",
    "mobileNumber": "మొబైల్ నంబర్",
    "sendOtp": "OTP పంపండి",
    "enterOtp": "6-అంకెల OTP ని నమోదు చేయండి",
    "verifyOtp": "ధృవీకరించి సేవ్ చేయండి",
    "preferredLanguage": "ప్రాధాన్య భాష",
    "otpHint": "ధృవీకరించడానికి 123456 నమోదు చేయండి (డెమో OTP)",
    "invalidOtp": "చెల్లని OTP. దయచేసి 123456 నమోదు చేయండి.",
    "invalidPhone": "దయచేసి 6-9 తో ప్రారంభమయ్యే సరైన 10-అంకెల ఫోన్ నంబర్‌ను నమోదు చేయండి."
  }
```


---

## 3. Seed Scripts Creating Users, Admins & Demo Accounts

### `server/seed/seedStores.js`
Creates 3 store owners (`store1@demo.com`, `store2@demo.com`, `store3@demo.com`) with role `store_owner` and their corresponding stores in Gudlavalleru.

```javascript
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Store = require('../src/models/Store');
const MasterProduct = require('../src/models/MasterProduct');
const StoreProduct = require('../src/models/StoreProduct');
const { STORE_OWNER } = require('../src/constants/roles');

const SEED_LAT = Number(process.env.SEED_LAT || 16.343565671713698);
const SEED_LNG = Number(process.env.SEED_LNG || 81.05408215921423);

const STORE_DEFINITIONS = [
  {
    ownerEmail: 'store1@demo.com',
    ownerName: 'Ramesh Kumar',
    ownerPhone: '9848011111',
    storeName: 'Sri Krishna Kirana & General Stores',
    slug: 'sri-krishna-kirana-stores',
    phone: '9848011111',
    address: 'Near Gandhi Statue, Main Road, Gudlavalleru',
    pincode: '521356',
    // ~300m away
    coordinates: [SEED_LNG + 0.002, SEED_LAT + 0.0018],
    isOpen: true,
    timings: { open: '07:00', close: '22:00' },
    deliveryRadiusKm: 3,
    deliveryFee: 1500, // ₹15.00
    freeDeliveryAbove: 24900, // ₹249.00
    minOrder: 4900, // ₹49.00
    supportsDelivery: true,
    supportsPickup: true,
    ratingAvg: 4.8,
    ratingCount: 142,
    productCountTarget: 50,
  },
  {
    ownerEmail: 'store2@demo.com',
    ownerName: 'Venkata Rao',
    ownerPhone: '9848022222',
    storeName: 'Gudlavalleru Super Bazaar',
    slug: 'gudlavalleru-super-bazaar',
    phone: '9848022222',
    address: 'Opp. Bus Stand, College Road, Gudlavalleru',
    pincode: '521356',
    // ~650m away
    coordinates: [SEED_LNG - 0.004, SEED_LAT - 0.003],
    isOpen: true,
    timings: { open: '06:30', close: '21:30' },
    deliveryRadiusKm: 4,
    deliveryFee: 2000, // ₹20.00
    freeDeliveryAbove: 29900, // ₹299.00
    minOrder: 9900, // ₹99.00
    supportsDelivery: true,
    supportsPickup: true,
    ratingAvg: 4.6,
    ratingCount: 98,
    productCountTarget: 55,
  },
  {
    ownerEmail: 'store3@demo.com',
    ownerName: 'Suresh Babu',
    ownerPhone: '9848033333',
    storeName: 'Balaji Provision Store',
    slug: 'balaji-provision-store',
    phone: '9848033333',
    address: 'Railway Station Road, Gudlavalleru',
    pincode: '521356',
    // ~1.05km away
    coordinates: [SEED_LNG + 0.007, SEED_LAT + 0.005],
    isOpen: false, // Closed store as requested!
    timings: { open: '08:00', close: '20:00' },
    deliveryRadiusKm: 2,
    deliveryFee: 2500, // ₹25.00
    freeDeliveryAbove: 34900, // ₹349.00
    minOrder: 9900, // ₹99.00
    supportsDelivery: true,
    supportsPickup: true,
    ratingAvg: 4.3,
    ratingCount: 45,
    productCountTarget: 45,
  },
];

async function seedStores() {
  try {
    await connectDB();
    console.log('Connected to MongoDB. Starting store seeding...');

    // Fetch master products
    const masterProducts = await MasterProduct.find({ isActive: true });
    if (masterProducts.length === 0) {
      console.error('No master products found! Please run npm run seed:catalogue first.');
      process.exit(1);
    }
    console.log(`Found ${masterProducts.length} active master products.`);

    for (const def of STORE_DEFINITIONS) {
      console.log(`\nProcessing store owner: ${def.ownerEmail}`);

      // 1. Ensure store owner user exists
      let owner = await User.findOne({ email: def.ownerEmail });
      if (!owner) {
        owner = await User.create({
          email: def.ownerEmail,
          name: def.ownerName,
          phone: def.ownerPhone,
          role: STORE_OWNER,
        });
        console.log(`✓ Created store owner: ${owner.name} (${owner.email})`);
      } else {
        owner.role = STORE_OWNER;
        owner.name = def.ownerName;
        owner.phone = def.ownerPhone;
        await owner.save();
        console.log(`✓ Updated existing owner: ${owner.name}`);
      }

      // 2. Ensure store exists
      let store = await Store.findOne({ owner: owner._id });
      if (!store) {
        store = await Store.create({
          owner: owner._id,
          name: def.storeName,
          slug: def.slug,
          phone: def.phone,
          address: def.address,
          pincode: def.pincode,
          location: {
            type: 'Point',
            coordinates: def.coordinates,
          },
          status: 'approved',
          isOpen: def.isOpen,
          timings: def.timings,
          deliveryRadiusKm: def.deliveryRadiusKm,
          deliveryFee: def.deliveryFee,
          freeDeliveryAbove: def.freeDeliveryAbove,
          minOrder: def.minOrder,
          supportsDelivery: def.supportsDelivery,
          supportsPickup: def.supportsPickup,
          ratingAvg: def.ratingAvg,
          ratingCount: def.ratingCount,
        });
        console.log(`✓ Created store: "${store.name}" (Status: approved, isOpen: ${store.isOpen})`);
      } else {
        store.name = def.storeName;
        store.phone = def.phone;
        store.address = def.address;
        store.pincode = def.pincode;
        store.location = {
          type: 'Point',
          coordinates: def.coordinates,
        };
        store.status = 'approved';
        store.isOpen = def.isOpen;
        store.timings = def.timings;
        store.deliveryRadiusKm = def.deliveryRadiusKm;
        store.deliveryFee = def.deliveryFee;
        store.freeDeliveryAbove = def.freeDeliveryAbove;
        store.minOrder = def.minOrder;
        store.supportsDelivery = def.supportsDelivery;
        store.supportsPickup = def.supportsPickup;
        store.ratingAvg = def.ratingAvg;
        store.ratingCount = def.ratingCount;
        await store.save();
        console.log(`✓ Updated store: "${store.name}" (isOpen: ${store.isOpen})`);
      }

      // 3. Seed 40–60 store products from master products
      const targetCount = Math.min(def.productCountTarget, masterProducts.length);
      const chosenMasters = masterProducts.slice(0, targetCount);

      let addedProducts = 0;
      for (let i = 0; i < chosenMasters.length; i++) {
        const master = chosenMasters[i];

        // Slightly different prices, never above MRP (2% to 12% discount)
        const discountFraction = 0.02 + ((i % 11) * 0.01);
        const price = Math.max(100, Math.floor(master.mrp * (1 - discountFraction)));

        const existing = await StoreProduct.findOne({
          store: store._id,
          masterProduct: master._id,
        });

        if (!existing) {
          await StoreProduct.create({
            store: store._id,
            masterProduct: master._id,
            price,
            mrp: master.mrp,
            inStock: i % 15 !== 0, // mark a few items out of stock for realism
            isActive: true,
          });
          addedProducts++;
        } else {
          existing.price = price;
          existing.mrp = master.mrp;
          existing.isActive = true;
          await existing.save();
        }
      }

      const totalStoreProducts = await StoreProduct.countDocuments({
        store: store._id,
        isActive: true,
      });
      console.log(
        `✓ Store has ${totalStoreProducts} active products (newly added: ${addedProducts}).`,
      );
    }

    console.log('\n=============================================');
    console.log('Stores and products seeded successfully! 🎉');
    console.log('=============================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding stores:', error);
    process.exit(1);
  }
}

seedStores();
```

---

### `server/seed/seedDemo.js`
Creates the default demo customer (`customer@demo.com`) with a Gudlavalleru delivery address, and generates 12 rich sample orders, payments, reviews, and complaints.

```javascript
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Store = require('../src/models/Store');
const StoreProduct = require('../src/models/StoreProduct');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const Review = require('../src/models/Review');
const Complaint = require('../src/models/Complaint');
const {
  PLACED,
  ACCEPTED,
  PACKING,
  READY,
  OUT_FOR_DELIVERY,
  DELIVERED,
  REJECTED,
  CANCELLED,
  EXPIRED,
} = require('../src/constants/orderStatus');
const { COD, CARD, UPI } = require('../src/constants/paymentMethod');
const { SUCCESS, REFUNDED } = require('../src/constants/paymentStatus');
const { CUSTOMER } = require('../src/constants/roles');

async function seedDemo() {
  try {
    await connectDB();
    console.log('Connected to MongoDB. Starting demo seeding...');

    // 1. Clean only demo-tagged records (idempotent)
    console.log('Cleaning previous demo orders, payments, reviews, and complaints...');
    await Promise.all([
      Order.deleteMany({ isDemo: true }),
      Payment.deleteMany({ isDemo: true }),
      Review.deleteMany({ isDemo: true }),
      Complaint.deleteMany({ isDemo: true }),
    ]);

    // 2. Fetch or create demo customer
    let customer = await User.findOne({ email: 'customer@demo.com' });
    if (!customer) {
      customer = await User.create({
        email: 'customer@demo.com',
        name: 'Demo Customer',
        role: CUSTOMER,
        phone: '9999999999',
        addresses: [
          {
            label: 'Home',
            line: 'Door 3-45, Brahmin Street, Gudlavalleru',
            pincode: '521356',
            landmark: 'Near Ganapathi Temple',
            location: {
              type: 'Point',
              coordinates: [81.054082, 16.343565],
            },
            isDefault: true,
          },
        ],
      });
    } else if (!customer.addresses || customer.addresses.length === 0) {
      customer.addresses = [
        {
          label: 'Home',
          line: 'Door 3-45, Brahmin Street, Gudlavalleru',
          pincode: '521356',
          landmark: 'Near Ganapathi Temple',
          location: {
            type: 'Point',
            coordinates: [81.054082, 16.343565],
          },
          isDefault: true,
        },
      ];
      await customer.save();
    }

    const defaultAddress = customer.addresses[0];
    const addressSnapshot = {
      label: defaultAddress.label,
      line: defaultAddress.line,
      pincode: defaultAddress.pincode,
      landmark: defaultAddress.landmark,
      location: defaultAddress.location,
    };

    // 3. Find stores
    const stores = await Store.find({ status: 'approved' }).limit(3);
    if (stores.length === 0) {
      console.error('No approved stores found. Please run npm run seed:stores first.');
      process.exit(1);
    }
    console.log(`Using ${stores.length} approved store(s) for demo orders.`);

    // Map store products
    const storeProductsMap = {};
    for (const s of stores) {
      const prods = await StoreProduct.find({ store: s._id, inStock: true, isActive: true }).limit(8);
      storeProductsMap[s._id.toString()] = prods;
    }

    const now = Date.now();
    const minAgo = (m) => new Date(now - m * 60 * 1000);
    const minFromNow = (m) => new Date(now + m * 60 * 1000);

    // Helpers to build order item snapshot
    const makeItems = (storeId, count = 2) => {
      const prods = storeProductsMap[storeId.toString()] || [];
      const selected = prods.slice(0, count);
      if (selected.length === 0) {
        // Fallback item if store has no products
        return [
          {
            storeProductId: new mongoose.Types.ObjectId(),
            name: 'Demo Product 1kg',
            nameTe: 'డెమో సరుకు 1కేజీ',
            unit: '1 kg',
            price: 6500, // ₹65.00
            qty: 1,
            available: true,
          },
        ];
      }
      return selected.map((p, idx) => ({
        storeProductId: p._id,
        name: p.customName || 'Store Item',
        nameTe: p.customName || 'సరుకు',
        unit: '1 pack',
        price: p.price,
        qty: idx === 0 ? 2 : 1,
        available: true,
      }));
    };

    // 12 Demo order blueprints
    const orderDefinitions = [
      // 1. PLACED
      {
        orderNo: 'KR-DEMO-1001',
        storeIndex: 0,
        status: PLACED,
        fulfilment: 'delivery',
        paymentMethod: COD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(2),
        expiresAt: minFromNow(1),
        itemCount: 2,
        history: [{ status: PLACED, at: minAgo(2), by: customer._id, byRole: 'customer', note: 'Order placed by customer' }],
      },
      // 2. ACCEPTED
      {
        orderNo: 'KR-DEMO-1002',
        storeIndex: 0,
        status: ACCEPTED,
        fulfilment: 'delivery',
        paymentMethod: CARD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(12),
        expiresAt: minFromNow(15),
        itemCount: 3,
        cardLast4: '4242',
        cardBrand: 'visa',
        history: [
          { status: PLACED, at: minAgo(12), by: customer._id, byRole: 'customer', note: 'Order placed by customer' },
          { status: ACCEPTED, at: minAgo(10), byRole: 'store', note: 'Store accepted the order' },
        ],
      },
      // 3. PACKING
      {
        orderNo: 'KR-DEMO-1003',
        storeIndex: 0,
        status: PACKING,
        fulfilment: 'delivery',
        paymentMethod: UPI,
        paymentStatus: SUCCESS,
        createdAt: minAgo(25),
        expiresAt: minFromNow(30),
        itemCount: 4,
        upiId: 'customer@okhdfcbank',
        history: [
          { status: PLACED, at: minAgo(25), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: ACCEPTED, at: minAgo(23), byRole: 'store', note: 'Store accepted' },
          { status: PACKING, at: minAgo(20), byRole: 'store', note: 'Items being packed into delivery bag' },
        ],
      },
      // 4. READY (Pickup)
      {
        orderNo: 'KR-DEMO-1004',
        storeIndex: 0,
        status: READY,
        fulfilment: 'pickup',
        paymentMethod: COD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(40),
        expiresAt: minFromNow(60),
        itemCount: 2,
        history: [
          { status: PLACED, at: minAgo(40), by: customer._id, byRole: 'customer', note: 'Self pickup order placed' },
          { status: ACCEPTED, at: minAgo(38), byRole: 'store', note: 'Store confirmed pickup order' },
          { status: PACKING, at: minAgo(35), byRole: 'store', note: 'Packing items' },
          { status: READY, at: minAgo(20), byRole: 'store', note: 'Order packed and ready at counter' },
        ],
      },
      // 5. OUT_FOR_DELIVERY
      {
        orderNo: 'KR-DEMO-1005',
        storeIndex: 1,
        status: OUT_FOR_DELIVERY,
        fulfilment: 'delivery',
        paymentMethod: CARD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(45),
        expiresAt: minFromNow(45),
        itemCount: 3,
        cardLast4: '1111',
        cardBrand: 'mastercard',
        history: [
          { status: PLACED, at: minAgo(45), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: ACCEPTED, at: minAgo(42), byRole: 'store', note: 'Accepted' },
          { status: PACKING, at: minAgo(35), byRole: 'store', note: 'Packing complete' },
          { status: READY, at: minAgo(25), byRole: 'store', note: 'Bag ready' },
          { status: OUT_FOR_DELIVERY, at: minAgo(15), byRole: 'store', note: 'Delivery rider is on the way' },
        ],
      },
      // 6. DELIVERED x 1 (With 5-star Review)
      {
        orderNo: 'KR-DEMO-1006',
        storeIndex: 0,
        status: DELIVERED,
        fulfilment: 'delivery',
        paymentMethod: UPI,
        paymentStatus: SUCCESS,
        createdAt: minAgo(180),
        expiresAt: minAgo(120),
        itemCount: 2,
        upiId: 'siva@ybl',
        history: [
          { status: PLACED, at: minAgo(180), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: ACCEPTED, at: minAgo(175), byRole: 'store', note: 'Order accepted' },
          { status: PACKING, at: minAgo(170), byRole: 'store', note: 'Packed' },
          { status: READY, at: minAgo(160), byRole: 'store', note: 'Ready' },
          { status: OUT_FOR_DELIVERY, at: minAgo(150), byRole: 'store', note: 'Out for delivery' },
          { status: DELIVERED, at: minAgo(135), byRole: 'store', note: 'Delivered to customer doorstep' },
        ],
        hasReview: {
          rating: 5,
          comment: 'సూపర్ సర్వీస్! సరుకులు చాలా ఫ్రెష్‌గా త్వరగా వచ్చాయి. ధన్యవాదాలు.',
        },
      },
      // 7. DELIVERED x 2 (Pickup with 4-star Review)
      {
        orderNo: 'KR-DEMO-1007',
        storeIndex: 1,
        status: DELIVERED,
        fulfilment: 'pickup',
        paymentMethod: COD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(320),
        expiresAt: minAgo(260),
        itemCount: 3,
        history: [
          { status: PLACED, at: minAgo(320), by: customer._id, byRole: 'customer', note: 'Pickup order placed' },
          { status: ACCEPTED, at: minAgo(315), byRole: 'store', note: 'Accepted' },
          { status: PACKING, at: minAgo(310), byRole: 'store', note: 'Packing' },
          { status: READY, at: minAgo(300), byRole: 'store', note: 'Ready at counter' },
          { status: DELIVERED, at: minAgo(280), byRole: 'store', note: 'Handed over to customer' },
        ],
        hasReview: {
          rating: 4,
          comment: 'Quick and hassle-free pickup at the counter. Everything was neatly organized.',
        },
      },
      // 8. DELIVERED x 3 (With Open Complaint)
      {
        orderNo: 'KR-DEMO-1008',
        storeIndex: 1,
        status: DELIVERED,
        fulfilment: 'delivery',
        paymentMethod: CARD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(480),
        expiresAt: minAgo(420),
        itemCount: 4,
        cardLast4: '8888',
        cardBrand: 'visa',
        history: [
          { status: PLACED, at: minAgo(480), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: ACCEPTED, at: minAgo(475), byRole: 'store', note: 'Accepted' },
          { status: PACKING, at: minAgo(465), byRole: 'store', note: 'Packing' },
          { status: READY, at: minAgo(455), byRole: 'store', note: 'Ready' },
          { status: OUT_FOR_DELIVERY, at: minAgo(445), byRole: 'store', note: 'Out for delivery' },
          { status: DELIVERED, at: minAgo(430), byRole: 'store', note: 'Delivered' },
        ],
        hasComplaint: {
          message: 'One packet of curd was missing from the bag. Please check with the store and assist.',
          status: 'open',
        },
      },
      // 9. DELIVERED x 4
      {
        orderNo: 'KR-DEMO-1009',
        storeIndex: stores.length > 2 ? 2 : 0,
        status: DELIVERED,
        fulfilment: 'delivery',
        paymentMethod: COD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(600),
        expiresAt: minAgo(540),
        itemCount: 2,
        history: [
          { status: PLACED, at: minAgo(600), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: ACCEPTED, at: minAgo(595), byRole: 'store', note: 'Accepted' },
          { status: PACKING, at: minAgo(585), byRole: 'store', note: 'Packed' },
          { status: READY, at: minAgo(575), byRole: 'store', note: 'Ready' },
          { status: OUT_FOR_DELIVERY, at: minAgo(565), byRole: 'store', note: 'Out for delivery' },
          { status: DELIVERED, at: minAgo(550), byRole: 'store', note: 'Delivered' },
        ],
      },
      // 10. REJECTED
      {
        orderNo: 'KR-DEMO-1010',
        storeIndex: 1,
        status: REJECTED,
        fulfilment: 'delivery',
        paymentMethod: COD,
        paymentStatus: REFUNDED,
        createdAt: minAgo(90),
        expiresAt: minAgo(87),
        itemCount: 2,
        rejectReason: 'Store closing soon for festival',
        history: [
          { status: PLACED, at: minAgo(90), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: REJECTED, at: minAgo(88), byRole: 'store', note: 'Store closing early for the festival' },
        ],
      },
      // 11. CANCELLED
      {
        orderNo: 'KR-DEMO-1011',
        storeIndex: 0,
        status: CANCELLED,
        fulfilment: 'delivery',
        paymentMethod: UPI,
        paymentStatus: REFUNDED,
        createdAt: minAgo(140),
        expiresAt: minAgo(130),
        itemCount: 2,
        upiId: 'customer@okhdfcbank',
        history: [
          { status: PLACED, at: minAgo(140), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: CANCELLED, at: minAgo(136), by: customer._id, byRole: 'customer', note: 'Customer cancelled: Ordered duplicate items' },
        ],
      },
      // 12. EXPIRED
      {
        orderNo: 'KR-DEMO-1012',
        storeIndex: 1,
        status: EXPIRED,
        fulfilment: 'delivery',
        paymentMethod: COD,
        paymentStatus: REFUNDED,
        createdAt: minAgo(240),
        expiresAt: minAgo(237),
        itemCount: 3,
        history: [
          { status: PLACED, at: minAgo(240), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: EXPIRED, at: minAgo(237), byRole: 'system', note: 'Store response timeout expired (3 minutes)' },
        ],
      },
    ];

    let createdOrdersCount = 0;
    for (const def of orderDefinitions) {
      const targetStore = stores[def.storeIndex] || stores[0];
      const items = makeItems(targetStore._id, def.itemCount);
      const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
      const deliveryFee = def.fulfilment === 'delivery' ? (subtotal >= targetStore.freeDeliveryAbove ? 0 : targetStore.deliveryFee) : 0;
      const total = subtotal + deliveryFee;

      // 1. Create Payment
      const payment = await Payment.create({
        user: customer._id,
        method: def.paymentMethod,
        amount: total,
        status: def.paymentStatus,
        last4: def.cardLast4 || null,
        brand: def.cardBrand || null,
        upiId: def.upiId || null,
        isDemo: true,
      });

      // 2. Create Order
      const order = await Order.create({
        orderNo: def.orderNo,
        customer: customer._id,
        store: targetStore._id,
        items,
        addressSnapshot,
        fulfilment: def.fulfilment,
        subtotal,
        deliveryFee,
        total,
        payment: payment._id,
        paymentMethod: def.paymentMethod,
        paymentStatus: def.paymentStatus,
        status: def.status,
        statusHistory: def.history,
        rejectReason: def.rejectReason || '',
        expiresAt: def.expiresAt,
        idempotencyKey: `demo-idemp-${def.orderNo}`,
        isDemo: true,
        createdAt: def.createdAt,
        updatedAt: def.createdAt,
      });

      // Link payment to order
      payment.order = order._id;
      await payment.save();

      // 3. Create Review if applicable
      if (def.hasReview) {
        await Review.create({
          user: customer._id,
          store: targetStore._id,
          order: order._id,
          rating: def.hasReview.rating,
          comment: def.hasReview.comment,
          isDemo: true,
        });
      }

      // 4. Create Complaint if applicable
      if (def.hasComplaint) {
        await Complaint.create({
          user: customer._id,
          order: order._id,
          message: def.hasComplaint.message,
          status: def.hasComplaint.status,
          isDemo: true,
        });
      }

      createdOrdersCount++;
    }

    console.log(`Successfully seeded ${createdOrdersCount} demo orders across ${stores.length} store(s)!`);
    console.log('Seeded demo reviews and complaints. Every dashboard and list now has rich demo content.');

    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error during demo seeding:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDemo();
}

module.exports = seedDemo;
```

---

### Dynamic Account Generation in `authService.js`
In addition to the database seed scripts, `server/src/services/authService.js` contains a dynamic on-demand demo account provisioning routine in `demoLogin(role)`. When a user clicks any Demo Quick Login button in dev mode, the following accounts are automatically upserted:

1. **`customer`**: `customer@demo.com` (Role: `customer`, Phone: `9999999999`)
2. **`store_owner`**: `store@demo.com` (Role: `store_owner`, Name: `ikshara (Store Owner)`, Phone: `9999999999`)
3. **`new_store_owner`**: `newstore@demo.com` (Role: `store_owner`, Name: `New Store Owner`, Phone: `9848099999`, has no store registered so the 4-step wizard can be tested)
4. **`admin`**: `admin@demo.com` (Role: `admin`, Name: `Demo Admin`, Phone: `9999999999`)

Additionally, when logging in with Google, `ADMIN_EMAILS` from `server/src/config/env.js` (defaulting to `admin@demo.com`) is checked: any email in `ADMIN_EMAILS` is automatically given the `admin` role upon first login.

---

## 4. Exhaustive Occurrences of "google", "oauth", and "GOOGLE_CLIENT"

The following is a complete grep across all files in the project (excluding `node_modules`, `.git`, `dist`, `.venv`, and `package-lock.json`).

| File Path | Line # | Matching Code / Text |
|---|---|---|
| `PROJECT_CONTEXT.md` | 18 | `Auth	Google OAuth + httpOnly cookie session. Dev-only Demo Login panel for the 3 roles` |
| `README.md` | 24 | `\| **Auth & Security** \| Google OAuth, httpOnly Cookie JWT sessions, Role-Based Access Control, Idempotency \|` |
| `README.md` | 55 | `GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com` |
| `README.md` | 62 | `VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com` |
| `README.md` | 87 | `In development mode ('NODE_ENV=development'), the login screen ('/login') provides a **Demo Quick Login** panel allowing instant access without requiring Google OAuth credentials:` |
| `client/.env` | 1 | `VITE_GOOGLE_CLIENT_ID=1064666955002-0h0rg4fgb84u23pelk8e17e61nnd7fmn.apps.googleusercontent.com` |
| `client/.env.example` | 1 | `# Google OAuth Client ID` |
| `client/.env.example` | 2 | `VITE_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com` |
| `client/index.html` | 15 | `<link rel="preconnect" href="https://fonts.googleapis.com" />` |
| `client/index.html` | 17 | `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Telugu:wght@400;500;600;700&display=swap" rel="stylesheet" />` |
| `client/package.json` | 16 | `"@react-oauth/google": "^0.13.5",` |
| `client/src/App.jsx` | 2 | `import { GoogleOAuthProvider } from '@react-oauth/google';` |
| `client/src/App.jsx` | 46 | `const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';` |
| `client/src/App.jsx` | 62 | `<GoogleOAuthProvider clientId={googleClientId}>` |
| `client/src/App.jsx` | 160 | `</GoogleOAuthProvider>` |
| `client/src/context/AuthContext.jsx` | 42 | `const loginWithGoogle = async (credential, intent = 'customer') => {` |
| `client/src/context/AuthContext.jsx` | 43 | `const res = await api.post('/auth/google', { credential, intent });` |
| `client/src/context/AuthContext.jsx` | 49 | `throw new Error('Google login failed');` |
| `client/src/context/AuthContext.jsx` | 75 | `loginWithGoogle,` |
| `client/src/i18n/en.json` | 70 | `"continueWithGoogle": "Continue with Google",` |
| `client/src/i18n/en.json` | 79 | `"googleFailed": "Google sign-in was cancelled or blocked. Please try again.",` |
| `client/src/i18n/en.json` | 256 | `"scanToOrder": "Scan with phone camera or Google Lens to order online",` |
| `client/src/i18n/en.json` | 344 | `"upiDesc": "Simulated instant Google Pay / PhonePe / Paytm",` |
| `client/src/i18n/te.json` | 70 | `"continueWithGoogle": "Google తో కొనసాగండి",` |
| `client/src/i18n/te.json` | 79 | `"googleFailed": "Google సైన్-ఇన్ విఫలమైంది లేదా రద్దు చేయబడింది. దయచేసి మళ్లీ ప్రయత్నించండి.",` |
| `client/src/i18n/te.json` | 344 | `"upiDesc": "Google Pay / PhonePe / Paytm అనుకరణ",` |
| `client/src/pages/customer/Checkout.jsx` | 429 | `(isTe ? 'GPay, PhonePe, Paytm, BHIM' : 'Google Pay, PhonePe, Paytm')}` |
| `client/src/pages/customer/Checkout.jsx` | 664 | `{isTe ? 'Google Pay, PhonePe, Paytm, BHIM' : 'Google Pay, PhonePe, Paytm, BHIM'}` |
| `client/src/pages/customer/Profile.jsx` | 667 | `Google OAuth profile credentials (name, email) for session authentication via httpOnly` |
| `client/src/pages/public/Login.jsx` | 4 | `import { GoogleLogin } from '@react-oauth/google';` |
| `client/src/pages/public/Login.jsx` | 12 | `const { user, loginWithGoogle, demoLogin } = useAuth();` |
| `client/src/pages/public/Login.jsx` | 41 | `const handleGoogleSuccess = async (credentialResponse) => {` |
| `client/src/pages/public/Login.jsx` | 43 | `const u = await loginWithGoogle(credentialResponse.credential, intent);` |
| `client/src/pages/public/Login.jsx` | 48 | `const msg = code === 'ACCOUNT_BLOCKED' ? t('auth.accountBlocked') : t('auth.googleFailed');` |
| `client/src/pages/public/Login.jsx` | 97 | `{/* Google OAuth Login Button */}` |
| `client/src/pages/public/Login.jsx` | 99 | `<GoogleLogin` |
| `client/src/pages/public/Login.jsx` | 100 | `onSuccess={handleGoogleSuccess}` |
| `client/src/pages/public/Login.jsx` | 101 | `onError={() => showToast({ type: 'error', message: t('auth.googleFailed') })}` |
| `client/src/pages/store/StoreSettings.jsx` | 549 | `Works with any Camera, Google Lens, or UPI App` |
| `server/.env` | 6 | `GOOGLE_CLIENT_ID=1064666955002-0h0rg4fgb84u23pelk8e17e61nnd7fmn.apps.googleusercontent.com` |
| `server/.env.example` | 16 | `# Google OAuth Client ID (must match frontend VITE_GOOGLE_CLIENT_ID)` |
| `server/.env.example` | 17 | `GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com` |
| `server/package.json` | 24 | `"google-auth-library": "^11.2.0",` |
| `server/src/config/env.js` | 8 | `const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';` |
| `server/src/config/env.js` | 25 | `GOOGLE_CLIENT_ID,` |
| `server/src/controllers/authController.js` | 5 | `const googleLogin = asyncHandler(async (req, res, next) => {` |
| `server/src/controllers/authController.js` | 9 | `return next(new AppError(400, 'INVALID_INPUT', 'Google credential is required'));` |
| `server/src/controllers/authController.js` | 12 | `const user = await authService.loginWithGoogle({ credential, intent });` |
| `server/src/controllers/authController.js` | 53 | `googleLogin,` |
| `server/src/controllers/userController.js` | 195 | `user.googleId = undefined;` |
| `server/src/models/User.js` | 49 | `googleId: {` |
| `server/src/routes/authRoutes.js` | 22 | `router.post('/google', authController.googleLogin);` |
| `server/src/services/authService.js` | 1 | `const { OAuth2Client } = require('google-auth-library');` |
| `server/src/services/authService.js` | 3 | `const { GOOGLE_CLIENT_ID, ADMIN_EMAILS, JWT_SECRET, NODE_ENV } = require('../config/env');` |
| `server/src/services/authService.js` | 8 | `const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);` |
| `server/src/services/authService.js` | 34 | `const verifyGoogleToken = async (credential) => {` |
| `server/src/services/authService.js` | 36 | `const ticket = await googleClient.verifyIdToken({` |
| `server/src/services/authService.js` | 38 | `audience: GOOGLE_CLIENT_ID,` |
| `server/src/services/authService.js` | 42 | `throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Google authentication failed: invalid token');` |
| `server/src/services/authService.js` | 46 | `const loginWithGoogle = async ({ credential, intent }) => {` |
| `server/src/services/authService.js` | 47 | `const payload = await verifyGoogleToken(credential);` |
| `server/src/services/authService.js` | 48 | `const { sub: googleId, email, name, picture } = payload;` |
| `server/src/services/authService.js` | 52 | `throw new AppError(400, 'INVALID_INPUT', 'Google account did not provide an email address');` |
| `server/src/services/authService.js` | 56 | `$or: [{ googleId }, { email: normalizedEmail }],` |
| `server/src/services/authService.js` | 65 | `if (!user.googleId) {` |
| `server/src/services/authService.js` | 66 | `user.googleId = googleId;` |
| `server/src/services/authService.js` | 88 | `googleId,` |
| `server/src/services/authService.js` | 152 | `loginWithGoogle,` |

---

## 5. Auth-Related Dependencies in `package.json`

### `client/package.json`
* **`@react-oauth/google`** (`^0.13.5`): Official Google Identity Services SDK wrapper for React. Powers the `<GoogleOAuthProvider>` wrapper in `App.jsx` and the `<GoogleLogin>` button in `Login.jsx`.
* **`axios`** (`^1.7.9`): HTTP client configured with `withCredentials: true` to automatically transmit and receive `token` httpOnly authentication cookies across API calls.

### `server/package.json`
* **`google-auth-library`** (`^11.2.0`): Google's Node.js auth client. Used in `authService.js` (`OAuth2Client.verifyIdToken`) to cryptographically verify Google ID token JWTs received from client login.
* **`jsonwebtoken`** (`^9.0.3`): Signs and verifies HS256 platform session tokens stored in the `token` cookie (`{ userId, role }`).
* **`cookie-parser`** (`^1.4.7`): Express middleware used in `app.js` to parse incoming HTTP cookies into `req.cookies`.
* **`express-rate-limit`** (`^8.7.1`): Rate limiting middleware configured on `authRoutes.js` (max 100 requests per 15-minute window) to mitigate brute-force authentication attacks.


---

## 6. Security & Role Test File & Google OAuth Removal Impact

### `server/tests/security.test.js`
Full file contents of the comprehensive security test suite covering role authorization, tenant isolation, price rules, tamper resistance, and blocked accounts:

```javascript
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
```

### Google OAuth Removal Impact Analysis
**Question:** *Which tests would break if Google OAuth were completely removed?*

**Answer:** **Zero (0) tests would break.**

**Explanation:**
1. Across the entire backend test suite (`security.test.js`, `bridges.test.js`, `orderService.test.js`, and `payment.test.js` — 62 tests in total), not a single test invokes the `POST /api/auth/google` endpoint.
2. In all integration and security tests, authentication is performed by creating test `User` documents in MongoDB and generating JWT session cookies directly using the internal helper:
   ```javascript
   const getCookie = (user) => {
     const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
     return `token=${token}`;
   };
   ```
3. The auth middleware (`server/src/middleware/auth.js`) only verifies the JWT in `req.cookies.token` against `JWT_SECRET` and fetches the `User` from MongoDB. It is completely decoupled from the upstream authentication provider (Google OAuth).
4. Therefore, removing `loginWithGoogle` and replacing it with mobile OTP, email/password, or any alternate auth mechanism would leave all 62 security, multi-tenant isolation, price enforcement, state machine, and bridge tests 100% intact and passing.

---

## 7. User Schema Fields, Store Linkage & Admin Approval Workflow

### User Schema Structure (`server/src/models/User.js`)

| Field | Type | Attributes / Constraints | Description / Purpose |
|---|---|---|---|
| `googleId` | `String` | Optional, `sparse: true`, `index: true` | Unique subject identifier (`sub`) from Google OAuth ID token. |
| `email` | `String` | Required, `unique: true`, `lowercase: true`, `trim: true`, `index: true` | Primary user identity email. |
| `name` | `String` | Required, `trim: true` | Display full name of user. |
| `photo` | `String` | Default: `""` | User avatar / Google profile picture URL. |
| `phone` | `String` | Default: `""` | 10-digit mobile number. Must be completed on `/complete-profile` for non-admin users. |
| `role` | `String` | Enum: `['customer', 'store_owner', 'admin']`, Default: `'customer'` | Role-based authorization badge. |
| `addresses` | `[addressSchema]` | Array of Subdocuments, Default: `[]` | Saved customer delivery locations in Gudlavalleru. |
| `addresses.label` | `String` | Enum: `['Home', 'Work', 'Other']`, Default: `'Home'` | Address label chip. |
| `addresses.line` | `String` | Required, `trim: true` | Street address / house number. |
| `addresses.pincode`| `String` | Required, `trim: true` (e.g. `'521356'`) | Postal code. |
| `addresses.landmark`| `String` | Default: `""`, `trim: true` | Nearby landmark (e.g. Ganapathi Temple). |
| `addresses.location`| GeoJSON Point | `{ type: 'Point', coordinates: [lng, lat] }` | WGS-84 coordinates for distance calculation. |
| `addresses.isDefault`| `Boolean`| Default: `false` | Default selected delivery address. |
| `language` | `String` | Enum: `['en', 'te']`, Default: `'en'` | User's preferred UI language. |
| `isBlocked` | `Boolean` | Default: `false` | Admin suspension flag. If `true`, rejected with `403 ACCOUNT_BLOCKED` on all routes. |
| `createdAt` / `updatedAt` | `Date` | Mongoose `{ timestamps: true }` | Audit timestamps. |

### How `store_owner` Users are Linked to a Store
1. **1-to-1 Association via Foreign Key:**
   In `server/src/models/Store.js`, the store model defines:
   ```javascript
   owner: {
     type: mongoose.Schema.Types.ObjectId,
     ref: 'User',
     required: true,
     unique: true,
     index: true,
   }
   ```
   Each store owner can own at most **one** store (enforced by the `unique: true` index on `owner`).
2. **Registration Linking:**
   When a user with `role === 'store_owner'` submits the 4-step registration wizard at `POST /api/stores/register`, the backend sets:
   ```javascript
   owner: req.user._id
   ```
   The store is initially saved with `status: 'pending'`.
3. **Retrieving the Owner's Store:**
   The backend route `GET /api/stores/me` executes:
   ```javascript
   const store = await Store.findOne({ owner: req.user._id });
   ```
   This endpoint provides the store status and details to the client.

### How Admin Approval Works
The store approval lifecycle proceeds through a clear state machine:
```
           ┌──────────┐
           │ pending  │
           └────┬─────┘
                │
     ┌──────────┴──────────┐
     ▼                     ▼
┌──────────┐          ┌──────────┐
│ approved │◄─────────┤ rejected │
└────┬─────┘(resubmit) └──────────┘
     │
     ▼
┌───────────┐
│ suspended │
└───────────┘
```

1. **Admin Review Queue:**
   The admin navigates to `/admin/stores` (`GET /api/admin/stores?status=pending`). The admin can inspect store metadata: store name, phone, address, location coordinates, delivery radius, delivery fee, GST/FSSAI numbers.
2. **Decision Execution:**
   The admin calls `PATCH /api/admin/stores/:id/status` (handled in `adminController.js -> updateAdminStoreStatus`):
   - **Approve:** Action `approve` updates `store.status = 'approved'` and clears `rejectionReason`.
   - **Reject:** Action `reject` requires a mandatory `rejectionReason` (e.g. "Address unverified") and sets `store.status = 'rejected'`.
   - **Suspend:** Action `suspend` sets `store.status = 'suspended'`.
   - **Reactivate:** Action `reactivate` restores `store.status = 'approved'`.
3. **Real-time Alerting:**
   The backend emits a WebSocket event `emitStoreApprovalStatus(store.owner, { status, rejectionReason })` to notify the store owner immediately without page refresh.
4. **Backend Enforcement (`requireApprovedStore.js`):**
   Any inventory modification (`/api/store-products/*`) or store order actions (`/api/store/orders/*`) pass through `requireApprovedStore`. If `store.status !== 'approved'`, the backend responds with `403 STORE_NOT_APPROVED`.
5. **Frontend Enforcement (`StoreGuard.jsx`):**
   - If store has `status === 'pending'`: Redirected to `/store/pending` ("Application Under Review").
   - If store has `status === 'rejected'`: Displays rejection reason with an "Edit Application" button allowing resubmission.
   - If store has `status === 'approved'`:
     - If products count < 10: Guided to `/store/products/add` (tick-and-price onboarding).
     - If products count ≥ 10: Allowed into `/store/orders` (Live orders dashboard).

---

## 8. Login Routes & Post-Login Views by Role

### 1. Routes & Pages for Login

| Route Path | Client Component | Access Level | Description |
|---|---|---|---|
| `/login` | `Login.jsx` | Public | Main authentication page. Houses Google OAuth button, role intent selector (`customer` vs `store_owner`), and in development (`NODE_ENV === 'development'`) the 4-persona Demo Quick Login panel. |
| `/complete-profile` | `CompleteProfile.jsx` | Authenticated (Missing Phone) | Mandatory profile completion page for all non-admin users without a saved `phone`. Collects Name, 10-digit Phone with mock OTP (`123456`), and Language preference (`en` vs `te`). |
| `/` | `HomeRedirect` in `App.jsx` | Public | Routing trampoline. If unauthenticated -> `/login`. If missing phone -> `/complete-profile`. If admin -> `/admin/dashboard`. If store_owner -> `/store/orders` (via `StoreGuard`). If customer -> `/app`. |

---

### 2. What Each Role Sees After Login

#### A. Customer (`role: 'customer'`)
* **Landing Route:** `/app` (`CustomerHome.jsx`) rendered inside `CustomerLayout.jsx`.
* **Top Navigation Bar:**
  - Active delivery location selector (defaults to Gudlavalleru PIN: `521356`).
  - Language toggle pill (English / తెలుగు).
  - Floating cart icon with real-time total badge.
* **Store Discovery:**
  - Displays approved kirana stores in Gudlavalleru (sorted by distance using `$geoNear`).
  - Store cards with status chips: "Open Now", "Free Delivery above ₹X", distance (e.g. `0.3 km`), and rating badge (e.g. `★ 4.8`).
* **Bottom Navigation Bar:**
  1. **Home** (`/app`): Nearby stores & category filters.
  2. **Search** (`/app/search`): Instant search for products across nearby stores.
  3. **Cart** (`/app/cart`): Active cart with item stepper, MRP savings breakdown, delivery fee calculation, and single-store replacement prompt.
  4. **Orders** (`/app/orders`): Active and past orders, live tracking timeline, 1-click reorder, store rating, and problem reporting.
  5. **Profile** (`/app/profile`): User details, address book manager, language selection, and logout.

#### B. Store Owner (`role: 'store_owner'`)
* **Landing Route:** Guarded by `StoreGuard.jsx` inside `StoreLayout.jsx`.
* **Dynamic Views Based on Store Lifecycle State:**
  1. **No Store Registered:**
     - Redirected to `/store/register` (`StoreRegister.jsx`).
     - Sees: 4-step store setup wizard (Step 1: Store name, phone, address; Step 2: Leaflet pin map location picker; Step 3: Operating timings & delivery radius 1–5 km; Step 4: Minimum order & delivery fees).
  2. **Application Pending (`status: 'pending'`):**
     - Redirected to `/store/pending` (`StorePending.jsx`).
     - Sees: "Application Under Review" banner, submitted details summary, and notice that platform administrators are verifying the shop.
  3. **Application Rejected (`status: 'rejected'`):**
     - Redirected to `/store/pending`.
     - Sees: Rejection alert with administrator notes (`rejectionReason`) and an "Edit Application" button allowing correction and resubmission.
  4. **Store Approved with < 10 Products:**
     - Redirected to `/store/products/add` (`StoreAddProducts.jsx`).
     - Sees: Tick-and-price onboarding table populated from the master catalogue to select at least 10 starter products.
  5. **Store Approved & Ready:**
     - Lands on `/store/orders` (`StoreOrders.jsx`).
     - **Live Orders Screen:** Audio notification chime and popup modal upon incoming orders (`emitOrderNew`).
     - **Order Fulfillment Workflow:** Accept button, move to Packing, interactive packing checklist, "Mark Unavailable" stockout button with instant customer alert, and "Mark Ready".
     - **Top/Bottom Navigation Tabs:**
       - **Live Orders** (`/store/orders`)
       - **Catalogue/Products** (`/store/products`): In-stock/out-of-stock toggles, price editor (validated against MRP ceiling).
       - **Earnings** (`/store/earnings`): Daily/weekly revenue bar charts (Recharts), delivered order count, top 5 selling items.
       - **Settings** (`/store/settings`): Store timings, delivery radius, shop open/close toggle, printable counter QR Code marketing poster.

#### C. Platform Admin (`role: 'admin'`)
* **Landing Route:** `/admin/dashboard` (`AdminDashboard.jsx`) rendered inside `AdminLayout.jsx`.
* **Executive Dashboard:**
  - KPI metric cards: Total Platform GMV (₹), Orders Today, Pending Store Approvals Queue Count, Active Kirana Stores Count.
  - Analytics visualizers: Category GMV distribution pie chart and Order status distribution bar chart.
* **Administrative Control Panels (Sidebar/Tabs):**
  1. **Stores** (`/admin/stores`): Review queue for pending stores, 1-click Approve button, Reject modal with required reason, Suspend / Reactivate controls.
  2. **Users** (`/admin/users`): Complete table of registered customers and store owners; toggle account suspension (Block / Unblock).
  3. **Catalogue** (`/admin/catalogue`): Full CRUD for Master Product Categories and Master Packaged Products (bilingual English/Telugu titles, brand, MRP in paise, unit sizes).
  4. **Orders** (`/admin/orders`): Global audit log of all platform orders with full status history timeline and Admin Force-Cancel capability.
  5. **Complaints** (`/admin/complaints`): Customer issue tickets with order context, resolution status toggle (`open` / `resolved`), and official admin response note.
  6. **Reports** (`/admin/reports`): Real-time CSV export downloads for Platform Orders and Stores.
