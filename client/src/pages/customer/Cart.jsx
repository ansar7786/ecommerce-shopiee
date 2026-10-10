import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Truck,
  Store as StoreIcon,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  PackageX,
  ChevronRight,
  Info,
  RefreshCw,
} from 'lucide-react';
import api from '../../api/axios';
import { useCart } from '../../context/CartContext';
import { Button, QuantityStepper, EmptyState, Card } from '../../components/ui';
import { formatPaise } from '../../utils/format';

export const Cart = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    cartStore,
    items,
    fulfilment,
    setFulfilment,
    updateQty,
    removeItem,
    clearCart,
    syncValidatedItems,
  } = useCart();

  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [validationData, setValidationData] = useState(null);
  const [priceNoticeDismissed, setPriceNoticeDismissed] = useState(false);

  // Validate cart against DB on load and whenever items/fulfilment change
  const validateCartWithServer = useCallback(async () => {
    if (!cartStore || items.length === 0) {
      setValidationData(null);
      return;
    }

    try {
      setValidating(true);
      setValidationError(null);

      const payload = {
        storeId: String(cartStore.id || cartStore._id),
        items: items.map((i) => ({
          storeProductId: i.storeProductId,
          qty: i.qty,
          price: i.price,
        })),
        fulfilment,
      };

      const res = await api.post('/cart/validate', payload);
      setValidationData(res.data);

      // If price changes detected, synchronize with local cart state
      if (res.data.hasPriceChanges && res.data.items) {
        syncValidatedItems(res.data.items);
      }
    } catch (err) {
      setValidationError(
        err.response?.data?.message || 'Unable to validate cart with the store. Please try again.',
      );
    } finally {
      setValidating(false);
    }
  }, [cartStore, items, fulfilment, syncValidatedItems]);

  useEffect(() => {
    validateCartWithServer();
    // Reset price notice dismissal when items change
    setPriceNoticeDismissed(false);
  }, [validateCartWithServer]);

  // Map out-of-stock and price-changed items from validation response
  const itemStatusMap = useMemo(() => {
    const map = new Map();
    if (validationData?.items) {
      for (const valItem of validationData.items) {
        map.set(String(valItem.storeProductId), valItem);
      }
    }
    return map;
  }, [validationData]);

  // Derived bill (server is single source of truth when validated, fallback to client estimates)
  const bill = useMemo(() => {
    if (validationData?.bill) {
      return validationData.bill;
    }
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const mrpTotal = items.reduce((sum, item) => sum + (item.mrp || item.price) * item.qty, 0);
    const savings = Math.max(0, mrpTotal - subtotal);
    let deliveryFee = 0;
    if (fulfilment === 'delivery' && cartStore) {
      if (cartStore.freeDeliveryAbove > 0 && subtotal >= cartStore.freeDeliveryAbove) {
        deliveryFee = 0;
      } else {
        deliveryFee = cartStore.deliveryFee || 0;
      }
    }
    return {
      subtotal,
      mrpTotal,
      savings,
      deliveryFee,
      total: subtotal + deliveryFee,
    };
  }, [validationData, items, fulfilment, cartStore]);

  // Validation flags
  const isStoreOpen = validationData ? validationData.storeOpen : true;
  const isBelowMinOrder = validationData ? validationData.belowMinOrder : false;
  const minOrderShort = validationData?.minOrderShort || 0;
  const hasOutOfStock = validationData ? validationData.hasOutOfStock : false;
  const hasPriceChanges = validationData ? validationData.hasPriceChanges : false;

  const minOrder = cartStore?.minOrder || 0;
  const freeDeliveryAbove = cartStore?.freeDeliveryAbove || 0;

  // Checkout can proceed only if valid
  const canCheckout =
    items.length > 0 &&
    isStoreOpen &&
    !isBelowMinOrder &&
    !hasOutOfStock &&
    !validating &&
    !validationError;

  if (items.length === 0) {
    return (
      <div className="pt-8 pb-20">
        <EmptyState
          icon={ShoppingBag}
          title={t('cart.emptyTitle')}
          description={t('cart.emptyDesc')}
          actionLabel={t('cart.browseNearby')}
          onAction={() => navigate('/app')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-32">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 min-h-[48px] text-xs font-bold text-ink-700 hover:text-ink-900 bg-white border border-ink-200 px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('common.back')}</span>
        </button>

        <button
          type="button"
          onClick={clearCart}
          className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline px-2 py-1 min-h-[48px] inline-flex items-center"
        >
          {t('cart.clearCart')}
        </button>
      </div>

      {/* Store Banner */}
      <div className="bg-white p-3.5 rounded-2xl border border-ink-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0 border border-primary-100">
            <StoreIcon className="w-5 h-5 stroke-[2]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide">
              {t('cart.orderingFrom')}
            </p>
            <h2 className="text-sm font-extrabold text-ink-900 truncate">{cartStore?.name}</h2>
          </div>
        </div>

        <Link
          to={`/app/store/${cartStore?.slug || cartStore?.id}`}
          className="text-xs font-bold text-primary-600 hover:text-primary-800 shrink-0 min-h-[48px] inline-flex items-center"
        >
          + {t('storeProducts.addMore')}
        </Link>
      </div>

      {/* Store Closed Warning */}
      {!isStoreOpen && (
        <div className="p-3.5 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900 leading-snug">
            <p className="font-extrabold text-sm text-red-950">{t('customer.closed')}</p>
            <p className="mt-0.5">{t('customer.storeClosedAlert')}</p>
          </div>
        </div>
      )}

      {/* Price Updated Notice */}
      {hasPriceChanges && !priceNoticeDismissed && (
        <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <RefreshCw className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 leading-snug">
              <p className="font-extrabold text-sm">Price Updated by Store</p>
              <p className="mt-0.5 text-amber-900">
                One or more items in your cart had a recent price update. Your bill has been updated
                with the latest store prices.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPriceNoticeDismissed(true)}
            className="text-xs font-bold text-amber-800 hover:text-amber-950 underline shrink-0"
          >
            Got it
          </button>
        </div>
      )}

      {/* Out of Stock Notice */}
      {hasOutOfStock && (
        <div className="p-3.5 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3 shadow-xs">
          <PackageX className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900 leading-snug">
            <p className="font-extrabold text-sm text-red-950">Out of Stock Items in Cart</p>
            <p className="mt-0.5">
              Some items are out of stock. Please remove them from your cart to enable checkout.
            </p>
          </div>
        </div>
      )}

      {/* Fulfilment Toggle (Delivery vs Pickup) */}
      <div className="bg-white p-1.5 rounded-2xl border border-ink-200 flex items-center gap-1 shadow-xs">
        <button
          type="button"
          onClick={() => setFulfilment('delivery')}
          className={`flex-1 py-2 px-3 min-h-[48px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            fulfilment === 'delivery'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-ink-600 hover:text-ink-900'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>{t('checkout.homeDelivery')}</span>
        </button>

        <button
          type="button"
          onClick={() => setFulfilment('pickup')}
          className={`flex-1 py-2 px-3 min-h-[48px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            fulfilment === 'pickup'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-ink-600 hover:text-ink-900'
          }`}
        >
          <StoreIcon className="w-4 h-4" />
          <span>{t('checkout.storePickup')}</span>
        </button>
      </div>

      {/* Cart Items List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider px-1">
          {t('nav.cart')} ({items.length})
        </h3>

        {items.map((item) => {
          const status = itemStatusMap.get(item.storeProductId);
          const isItemOutOfStock = status ? !status.inStock || !status.available : false;
          const isItemPriceChanged = status ? Boolean(status.priceChanged) : false;

          return (
            <Card
              key={item.storeProductId}
              className={`p-3.5 border rounded-2xl transition-all ${
                isItemOutOfStock
                  ? 'border-red-300 bg-red-50/40'
                  : isItemPriceChanged
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-ink-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-xl bg-gray-50 border border-ink-100 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ShoppingBag className="w-7 h-7 text-ink-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-ink-900 leading-snug line-clamp-1">
                    {item.nameTe || item.name}
                  </h4>
                  {item.nameTe && item.name && (
                    <p className="text-xs text-ink-500 truncate">{item.name}</p>
                  )}
                  <p className="text-[11px] text-ink-400 font-medium mt-0.5">{item.unit}</p>

                  {/* Price info */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm font-black text-ink-900">
                      {formatPaise(item.price)}
                    </span>
                    {item.mrp && item.mrp > item.price && (
                      <span className="text-xs text-ink-400 line-through">
                        {formatPaise(item.mrp)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => removeItem(item.storeProductId)}
                  className="p-1.5 min-h-[48px] min-w-[48px] flex items-center justify-center text-ink-400 hover:text-red-600 transition-colors rounded-lg shrink-0"
                  title={t('common.remove')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Status Notice for this specific item */}
              {isItemOutOfStock && (
                <div className="mt-2.5 p-2 bg-red-100/90 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-900 font-bold">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    {t('storeProducts.outOfStock')}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.storeProductId)}
                    className="underline text-red-700 hover:text-red-950 min-h-[48px] inline-flex items-center"
                  >
                    {t('common.remove')}
                  </button>
                </div>
              )}

              {isItemPriceChanged && (
                <div className="mt-2 p-1.5 bg-amber-100/80 rounded-xl text-[11px] text-amber-900 font-semibold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>{formatPaise(item.price)}</span>
                </div>
              )}

              {/* Stepper Footer Row */}
              <div className="mt-3 pt-2.5 border-t border-ink-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-600">{t('catalogue.unit')}</span>
                <QuantityStepper
                  value={item.qty}
                  min={0}
                  max={10}
                  onChange={(nextQty) => updateQty(item.storeProductId, nextQty)}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Nudge 1: Minimum Order Progress */}
      {minOrder > 0 && bill.subtotal < minOrder && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-amber-950">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              {t('customer.minOrder', { amount: formatPaise(minOrder) })}
            </span>
            <span>{Math.round((bill.subtotal / minOrder) * 100)}%</span>
          </div>

          <div className="w-full bg-amber-200/80 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (bill.subtotal / minOrder) * 100)}%` }}
            />
          </div>

          <p className="text-[11px] text-amber-900 font-medium">
            {t('cart.belowMin', {
              amount: formatPaise(minOrderShort || Math.max(0, minOrder - bill.subtotal)),
              min: formatPaise(minOrder),
            })}
          </p>
        </div>
      )}

      {/* Nudge 2: Free Delivery Progress (only if fulfilment is delivery) */}
      {fulfilment === 'delivery' && freeDeliveryAbove > 0 && (
        <div
          className={`p-3.5 rounded-2xl border space-y-2 ${
            bill.subtotal >= freeDeliveryAbove
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-primary-50 border-primary-200'
          }`}
        >
          {bill.subtotal >= freeDeliveryAbove ? (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t('cart.freeUnlocked')}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs font-bold text-primary-950">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-primary-600" />
                  {t('customer.freeDeliveryAbove', { amount: formatPaise(freeDeliveryAbove) })}
                </span>
                <span>{Math.round((bill.subtotal / freeDeliveryAbove) * 100)}%</span>
              </div>

              <div className="w-full bg-primary-200/80 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (bill.subtotal / freeDeliveryAbove) * 100)}%`,
                  }}
                />
              </div>

              <p className="text-[11px] text-primary-900 font-medium">
                {t('cart.nearFree', { amount: formatPaise(freeDeliveryAbove - bill.subtotal) })}
              </p>
            </>
          )}
        </div>
      )}

      {/* Savings Highlight */}
      {bill.savings > 0 && (
        <div className="p-3 bg-accent-50 border border-accent-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-accent-950">
            <Sparkles className="w-4 h-4 text-accent-600" />
            <span>{t('cart.savings', { amount: formatPaise(bill.savings) })}</span>
          </div>
        </div>
      )}

      {/* Authoritative Live Bill Card */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white space-y-3">
        <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
          {t('cart.billDetails')}
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-ink-700">
            <span>{t('cart.itemTotal')}</span>
            <span className="font-bold">{formatPaise(bill.subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-ink-700">
            <span>{t('cart.deliveryFee')}</span>
            {bill.deliveryFee === 0 ? (
              <span className="font-extrabold text-emerald-600">{t('cart.free')}</span>
            ) : (
              <span className="font-bold">{formatPaise(bill.deliveryFee)}</span>
            )}
          </div>

          <div className="pt-2 border-t border-ink-100 flex items-center justify-between text-sm font-black text-ink-900">
            <span>{t('cart.toPay')}</span>
            <span className="text-base text-primary-700">{formatPaise(bill.total)}</span>
          </div>
        </div>
      </Card>

      {/* Fixed Sticky Checkout Bar */}
      <aside
        aria-label="Checkout action bar"
        className="fixed bottom-16 left-0 right-0 z-35 max-w-md mx-auto px-4 pointer-events-none"
      >
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-ink-200 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-medium text-ink-500">{t('cart.toPay')}</span>
            <span className="text-base font-black text-ink-900 leading-tight">
              {formatPaise(bill.total)}
            </span>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!canCheckout}
            onClick={() => {
              navigate('/app/checkout');
            }}
            className="flex-1 font-extrabold text-sm min-h-[48px] shadow-md flex items-center justify-center gap-1.5"
          >
            <span>
              {!isStoreOpen
                ? t('customer.closed')
                : hasOutOfStock
                  ? t('cart.itemsUnavailableWarning')
                  : isBelowMinOrder
                    ? t('customer.minOrder', { amount: formatPaise(minOrder) })
                    : t('cart.proceedToCheckout')}
            </span>
            {canCheckout && <ChevronRight className="w-4 h-4 stroke-[2.5]" />}
          </Button>
        </div>
      </aside>
    </div>
  );
};
