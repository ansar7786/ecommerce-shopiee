const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { CLIENT_ORIGIN, NODE_ENV } = require('./config/env');
const AppError = require('./utils/AppError');
const errorHandler = require('./middleware/error');

const app = express();

const allowedOrigins = Array.from(
  new Set([CLIENT_ORIGIN, 'http://localhost:5802', 'http://localhost:5173'].filter(Boolean)),
);

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

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

app.use('/api', apiRouter);

// 404 handler
app.use((req, res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`));
});

// Global error handler
app.use(errorHandler);

module.exports = app;
