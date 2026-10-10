/**
 * Pricing service to compute bills and totals in integer paise.
 * Server is the single source of truth for all pricing and fee calculations.
 */

function computeBill(store, items, fulfilment = 'delivery') {
  if (!items || !Array.isArray(items)) {
    return {
      subtotal: 0,
      mrpTotal: 0,
      savings: 0,
      deliveryFee: 0,
      total: 0,
      fulfilment,
    };
  }

  // 1. Calculate subtotal & mrp total (in integer paise)
  let subtotal = 0;
  let mrpTotal = 0;

  for (const item of items) {
    const qty = Math.max(1, Math.min(10, Number(item.qty) || 1));
    const price = Number(item.price) || 0;
    const mrp = Number(item.mrp) || price;

    subtotal += price * qty;
    mrpTotal += mrp * qty;
  }

  // 2. Savings vs MRP
  const savings = Math.max(0, mrpTotal - subtotal);

  // 3. Delivery fee: 0 if pickup or subtotal >= freeDeliveryAbove
  let deliveryFee = 0;
  if (fulfilment === 'pickup') {
    deliveryFee = 0;
  } else if (
    store?.freeDeliveryAbove &&
    store.freeDeliveryAbove > 0 &&
    subtotal >= store.freeDeliveryAbove
  ) {
    deliveryFee = 0;
  } else {
    deliveryFee = store?.deliveryFee || 0;
  }

  // 4. Final total
  const total = subtotal + deliveryFee;

  return {
    subtotal,
    mrpTotal,
    savings,
    deliveryFee,
    total,
    fulfilment,
  };
}

module.exports = {
  computeBill,
};
