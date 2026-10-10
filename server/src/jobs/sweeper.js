const Order = require('../models/Order');
const orderService = require('../services/orderService');
const { PLACED, AWAITING_CUSTOMER, EXPIRED, CANCELLED } = require('../constants/orderStatus');

let sweeperInterval = null;

/**
 * Sweeps expired orders based on expiresAt.
 * PLACED -> EXPIRED (system)
 * AWAITING_CUSTOMER -> CANCELLED (system)
 */
async function sweepExpiredOrders() {
  const now = new Date();

  try {
    // 1. Expire unaccepted PLACED orders past expiresAt
    const expiredPlacedOrders = await Order.find({
      status: PLACED,
      expiresAt: { $lte: now },
    });

    for (const order of expiredPlacedOrders) {
      try {
        await orderService.transition(order._id, EXPIRED, {
          actor: null,
          role: 'system',
          expectedStatus: PLACED,
          note: 'Store response timed out after 3 minutes',
        });
        console.log(`[Sweeper] Order ${order.orderNo} moved to EXPIRED`);
      } catch (err) {
        // Status may have changed concurrently, skip safely
        console.warn(`[Sweeper] Could not expire order ${order.orderNo}:`, err.message);
      }
    }

    // 2. Cancel unconfirmed AWAITING_CUSTOMER orders past expiresAt
    const expiredCustomerOrders = await Order.find({
      status: AWAITING_CUSTOMER,
      expiresAt: { $lte: now },
    });

    for (const order of expiredCustomerOrders) {
      try {
        await orderService.transition(order._id, CANCELLED, {
          actor: null,
          role: 'system',
          expectedStatus: AWAITING_CUSTOMER,
          note: 'Customer confirmation timed out after 10 minutes',
        });
        console.log(`[Sweeper] Order ${order.orderNo} cancelled due to customer timeout`);
      } catch (err) {
        // Status may have changed concurrently, skip safely
        console.warn(`[Sweeper] Could not cancel order ${order.orderNo}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Sweeper] Error sweeping expired orders:', err.message);
  }
}

function startSweeper(intervalMs = 30000) {
  if (sweeperInterval) return;
  console.log(`[Sweeper] Background order sweeper started (every ${intervalMs / 1000}s)`);
  sweeperInterval = setInterval(sweepExpiredOrders, intervalMs);
}

function stopSweeper() {
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
    sweeperInterval = null;
    console.log('[Sweeper] Background order sweeper stopped');
  }
}

module.exports = {
  sweepExpiredOrders,
  startSweeper,
  stopSweeper,
};
