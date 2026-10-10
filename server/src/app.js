const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { CLIENT_ORIGIN, NODE_ENV } = require('./config/env');
const AppError = require('./utils/AppError');
const errorHandler = require('./middleware/error');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const storeRoutes = require('./routes/storeRoutes');
const masterProductRoutes = require('./routes/masterProductRoutes');
const storeProductRoutes = require('./routes/storeProductRoutes');
const cartRoutes = require('./routes/cartRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const orderRoutes = require('./routes/orderRoutes');
const storeOrderRoutes = require('./routes/storeOrderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const Category = require('./models/Category');

const app = express();

const allowedOrigins = Array.from(
  new Set([CLIENT_ORIGIN, 'http://localhost:5802', 'http://localhost:5173'].filter(Boolean)),
);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const apiRouter = express.Router();

const DB_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

apiRouter.get('/health', (req, res) => {
  const dbStatus = DB_STATES[mongoose.connection.readyState] || 'disconnected';
  res.json({
    success: true,
    status: 'ok',
    time: new Date().toISOString(),
    db: dbStatus,
  });
});

// Categories list for all users
apiRouter.get('/categories', async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
});

// Dev-only helper endpoint for demo locations
apiRouter.get('/dev/seed-location', (req, res, next) => {
  if (NODE_ENV === 'production') {
    return next(new AppError(404, 'NOT_FOUND', 'Not found in production'));
  }
  res.json({
    success: true,
    lat: Number(process.env.SEED_LAT || 16.343565671713698),
    lng: Number(process.env.SEED_LNG || 81.05408215921423),
    pincode: '521356',
    landmark: 'Gudlavalleru Engineering College',
    line: 'Main Road, Gudlavalleru',
  });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/store/orders', storeOrderRoutes);
apiRouter.use('/stores', storeRoutes);
apiRouter.use('/store', storeRoutes);
apiRouter.use('/master-products', masterProductRoutes);
apiRouter.use('/store-products', storeProductRoutes);
apiRouter.use('/cart', cartRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/reviews', reviewRoutes);
apiRouter.use('/complaints', complaintRoutes);

app.use('/api', apiRouter);

// 404 handler
app.use((req, res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`));
});

// Global error handler
app.use(errorHandler);

module.exports = app;
