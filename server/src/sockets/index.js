const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, CLIENT_ORIGIN } = require('../config/env');
const User = require('../models/User');
const Store = require('../models/Store');

let ioInstance = null;

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const items = cookieHeader.split(';');
  for (const item of items) {
    const parts = item.split('=');
    if (parts.length === 2) {
      cookies[parts[0].trim()] = decodeURIComponent(parts[1].trim());
    }
  }
  return cookies;
}

function initSocket(httpServer) {
  const allowedOrigins = Array.from(
    new Set([CLIENT_ORIGIN, 'http://localhost:5802', 'http://localhost:5173'].filter(Boolean)),
  );

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication Middleware via Handshake Cookie
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers?.cookie || '';
      const cookies = parseCookies(cookieHeader);
      const token = cookies.token;

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {
        return next(new Error('Invalid or expired token'));
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      if (user.isBlocked) {
        return next(new Error('User account is blocked'));
      }

      socket.data.user = user;
      return next();
    } catch (err) {
      return next(new Error(`Authentication failed: ${err.message}`));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user;
    if (!user) return;

    // 1. Join customer room
    const customerRoom = `customer:${user._id}`;
    socket.join(customerRoom);

    // 2. If store owner, find their approved store and join store room
    if (user.role === 'store_owner') {
      try {
        const store = await Store.findOne({ owner: user._id });
        if (store) {
          const storeRoom = `store:${store._id}`;
          socket.join(storeRoom);
          socket.data.storeId = String(store._id);
        }
      } catch (err) {
        console.error('[Socket] Error finding store for owner:', err.message);
      }
    }

    socket.on('disconnect', () => {
      // Automatic room cleanup by Socket.IO
    });
  });

  ioInstance = io;
  return io;
}

function getIO() {
  return ioInstance;
}

// Event Emitters
function emitOrderNew(storeId, order) {
  if (!ioInstance) return;
  ioInstance.to(`store:${storeId}`).emit('order:new', { order });
}

function emitOrderStatus(order) {
  if (!ioInstance || !order) return;
  const storeId = order.store?._id || order.store;
  const customerId = order.customer?._id || order.customer;

  if (storeId) {
    ioInstance.to(`store:${storeId}`).emit('order:status', { order });
  }
  if (customerId) {
    ioInstance.to(`customer:${customerId}`).emit('order:status', { order });
  }
}

function emitOrderItemsChanged(order) {
  if (!ioInstance || !order) return;
  const customerId = order.customer?._id || order.customer;
  if (customerId) {
    ioInstance.to(`customer:${customerId}`).emit('order:items-changed', { order });
  }
}

function emitStoreStatus(storeId, isOpen) {
  if (!ioInstance) return;
  ioInstance.emit('store:status', { storeId: String(storeId), isOpen });
}

module.exports = {
  initSocket,
  getIO,
  emitOrderNew,
  emitOrderStatus,
  emitOrderItemsChanged,
  emitStoreStatus,
};
