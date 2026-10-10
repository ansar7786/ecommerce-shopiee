import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  MapPin,
  Truck,
  Store as StoreIcon,
  Banknote,
  AlertTriangle,
  ChevronRight,
  Plus,
  Check,
  Clock,
  CreditCard,
  Smartphone,
} from 'lucide-react';
import api from '../../api/axios';
import { useCart } from '../../context/CartContext';
import { useLocationContext } from '../../context/LocationContext';
import { Button, BottomSheet, Card, EmptyState } from '../../components/ui';
import { formatPaise } from '../../utils/format';
import { CardPaymentModal } from '../../components/payment/CardPaymentModal';
import { UpiPaymentModal } from '../../components/payment/UpiPaymentModal';

function calculateDistanceKm(coord1, coord2) {
  if (!coord1 || !coord2) return 0;
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export const Checkout = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  const { cartStore, items, fulfilment, setFulfilment, subtotal, savings, clearCart } = useCart();
  const { activeAddress, addresses, selectAddress } = useLocationContext();

  const [store, setStore] = useState(null);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState(null);

  // Payment Method Picker state: 'COD' | 'CARD' | 'UPI'
  const [selectedMethod, setSelectedMethod] = useState('COD');
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  // Modals for prepaid flows
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [upiModalOpen, setUpiModalOpen] = useState(false);

  // Stable idempotency key stored for the checkout session
  const idempotencyKeyRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  );

  // Load store details for delivery rules & radius
  const fetchStoreDetails = useCallback(async () => {
    if (!cartStore?.id && !cartStore?._id) return;
    try {
      const res = await api.get(`/stores/${cartStore.id || cartStore._id}`);
      setStore(res.data.store);
    } catch {
      // Ignored
    }
  }, [cartStore]);

  useEffect(() => {
    fetchStoreDetails();
  }, [fetchStoreDetails]);

  // Check distance if delivery
  const distanceKm = useMemo(() => {
    if (!store?.location?.coordinates || !activeAddress?.location?.coordinates) return 0;
    return calculateDistanceKm(activeAddress.location.coordinates, store.location.coordinates);
  }, [store, activeAddress]);

  const maxRadiusKm = store?.deliveryRadiusKm || 3;
  const isOutsideDeliveryRadius =
    fulfilment === 'delivery' && Boolean(activeAddress) && distanceKm > maxRadiusKm;

  // Authoritative bill calculation
  const deliveryFee = useMemo(() => {
    if (fulfilment === 'pickup') return 0;
    if (
      store?.freeDeliveryAbove &&
      store.freeDeliveryAbove > 0 &&
      subtotal >= store.freeDeliveryAbove
    ) {
      return 0;
    }
    return store?.deliveryFee ?? cartStore?.deliveryFee ?? 0;
  }, [fulfilment, store, cartStore, subtotal]);

  const total = subtotal + deliveryFee;

  // COD rule: disabled if total > 200,000 paise (₹2,000)
  const isCodDisabled = total > 200000;

  // Automatically switch if COD becomes disabled
  useEffect(() => {
    if (isCodDisabled && selectedMethod === 'COD') {
      setSelectedMethod('UPI');
    }
  }, [isCodDisabled, selectedMethod]);

  // Validation flag
  const canPlaceOrder =
    items.length > 0 &&
    !submitting &&
    (fulfilment === 'pickup' || (Boolean(activeAddress) && !isOutsideDeliveryRadius));

  // Authoritative order creator given a confirmed paymentId
  const placeOrderWithPayment = async (paymentId) => {
    try {
      setSubmitting(true);
      setOrderError(null);

      const payload = {
        storeId: String(cartStore.id || cartStore._id),
        items: items.map((i) => ({
          storeProductId: i.storeProductId,
          qty: i.qty,
        })),
        fulfilment,
        addressId: fulfilment === 'delivery' ? activeAddress?._id : undefined,
        note: deliveryNote.trim(),
        paymentId,
        idempotencyKey: idempotencyKeyRef.current,
      };

      const orderRes = await api.post('/orders', payload);
      const createdOrder = orderRes.data.order;

      // Clear cart on success & navigate to C7 placed page
      clearCart();
      navigate(`/app/order/${createdOrder._id || createdOrder.orderNo}/placed`, {
        replace: true,
        state: { order: createdOrder },
      });
    } catch (err) {
      setOrderError(
        err.response?.data?.message ||
          (isTe
            ? 'ఆర్డర్ నమోదు విఫలమైంది. దయచేసి మళ్ళీ ప్రయత్నించండి.'
            : 'Failed to place order. Please try again.'),
      );
      setSubmitting(false);
    }
  };

  // Triggered when user clicks main CTA button
  const handleCheckoutCta = async () => {
    if (!canPlaceOrder || submitting) return;

    if (selectedMethod === 'CARD') {
      setCardModalOpen(true);
      return;
    }

    if (selectedMethod === 'UPI') {
      setUpiModalOpen(true);
      return;
    }

    // COD Flow: initiate then place order immediately
    try {
      setSubmitting(true);
      setOrderError(null);

      const paymentRes = await api.post('/payments/initiate', {
        method: 'COD',
        storeId: String(cartStore.id || cartStore._id),
        items: items.map((i) => ({
          storeProductId: i.storeProductId,
          qty: i.qty,
        })),
        fulfilment,
        amount: total,
      });

      const paymentId = paymentRes.data.payment._id || paymentRes.data.payment.id;
      await placeOrderWithPayment(paymentId);
    } catch (err) {
      setOrderError(
        err.response?.data?.message ||
          (isTe ? 'నగదు చెల్లింపు ప్రారంభం కాలేదు.' : 'Failed to initiate Cash on Delivery.'),
      );
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="pt-8">
        <EmptyState
          icon={StoreIcon}
          title={isTe ? 'కార్ట్‌లో వస్తువులు లేవు' : 'No Items to Checkout'}
          description={
            isTe
              ? 'మీ కార్ట్ ప్రస్తుతం ఖాళీగా ఉంది. కొనసాగడానికి వస్తువులను జోడించండి.'
              : 'Your cart is currently empty. Add items from a store to proceed.'
          }
          actionLabel={isTe ? 'కిరాణా దుకాణాలు చూడండి' : 'Explore Stores'}
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
          onClick={() => navigate('/app/cart')}
          className="flex items-center gap-1.5 text-xs font-bold text-ink-700 hover:text-ink-900 bg-white border border-ink-200 px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isTe ? 'కార్ట్' : 'Cart'}</span>
        </button>
        <span className="text-xs font-bold text-ink-600">{isTe ? 'చెక్అవుట్' : 'Checkout'}</span>
      </div>

      {/* Store Banner */}
      <div className="bg-white p-3.5 rounded-2xl border border-ink-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0 border border-primary-100">
            <StoreIcon className="w-5 h-5 stroke-[2]" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wide">
              {isTe ? 'దుకాణం' : 'Store'}
            </span>
            <h2 className="text-sm font-extrabold text-ink-900 truncate">{cartStore?.name}</h2>
          </div>
        </div>

        {store?.timings && (
          <div className="flex items-center gap-1 text-[11px] font-semibold text-ink-600 bg-ink-50 px-2 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-ink-500" />
            <span>
              {store.timings.open} - {store.timings.close}
            </span>
          </div>
        )}
      </div>

      {/* Fulfilment Toggle */}
      <div className="bg-white p-1.5 rounded-2xl border border-ink-200 shadow-xs flex gap-1">
        {(store?.supportsDelivery ?? true) && (
          <button
            type="button"
            onClick={() => setFulfilment('delivery')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
              fulfilment === 'delivery'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>{isTe ? 'ఇంటి వద్దకు డెలివరీ' : 'Home Delivery'}</span>
          </button>
        )}

        {(store?.supportsPickup ?? true) && (
          <button
            type="button"
            onClick={() => setFulfilment('pickup')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
              fulfilment === 'pickup'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            <StoreIcon className="w-4 h-4" />
            <span>{isTe ? 'దుకాణం వద్ద పికప్' : 'Store Pickup'}</span>
          </button>
        )}
      </div>

      {/* Delivery Address Card */}
      {fulfilment === 'delivery' && (
        <Card className="p-4 border border-ink-200 rounded-2xl bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-600" />
              <h3 className="text-xs font-extrabold text-ink-900 uppercase tracking-wide">
                {isTe ? 'డెలివరీ చిరునామా' : 'Delivery Address'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setAddressSheetOpen(true)}
              className="text-xs font-bold text-primary-600 hover:text-primary-800"
            >
              {isTe ? 'మార్చండి' : 'Change'}
            </button>
          </div>

          {activeAddress ? (
            <div className="p-3 rounded-xl bg-ink-50/70 border border-ink-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-900">{activeAddress.label}</span>
                {distanceKm > 0 && (
                  <span className="text-[11px] font-semibold text-ink-500">
                    {distanceKm} km {isTe ? 'దూరం' : 'away'}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-600 leading-snug">{activeAddress.line}</p>
              {activeAddress.landmark && (
                <p className="text-[11px] text-ink-500">
                  {isTe ? 'గుర్తు: ' : 'Landmark: '}
                  {activeAddress.landmark} • {activeAddress.pincode}
                </p>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-dashed border-ink-300 text-center space-y-2">
              <p className="text-xs text-ink-600">
                {isTe ? 'డెలివరీ చిరునామా ఎంపిక చేయబడలేదు' : 'No delivery address selected'}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setAddressSheetOpen(true)}
                className="w-full text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>{isTe ? 'చిరునామా ఎంచుకోండి' : 'Choose Address'}</span>
              </Button>
            </div>
          )}

          {isOutsideDeliveryRadius && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                {isTe
                  ? `ఈ చిరునామా దుకాణం డెలివరీ పరిధి (${maxRadiusKm} కి.మీ) వెలుపల ఉంది.`
                  : `Address is outside this store's ${maxRadiusKm} km delivery radius.`}
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Delivery Instructions / Note */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white space-y-2">
        <label
          htmlFor="delivery-instructions"
          className="text-xs font-extrabold text-ink-900 uppercase tracking-wide block"
        >
          {isTe ? 'డెలివరీ సూచనలు (ఐచ్ఛికం)' : 'Delivery Instructions (Optional)'}
        </label>
        <input
          id="delivery-instructions"
          type="text"
          placeholder={
            isTe
              ? 'ఉదా: గేటు వద్ద ఉంచండి, ఫోన్ చేయండి...'
              : 'e.g. Leave at door, call before arriving...'
          }
          value={deliveryNote}
          onChange={(e) => setDeliveryNote(e.target.value)}
          maxLength={150}
          className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all placeholder:text-ink-400"
        />
      </Card>

      {/* Payment Method Selector Card */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-ink-900 uppercase tracking-wide">
            {isTe ? 'చెల్లింపు విధానం' : 'Payment Method'}
          </h3>
          <button
            type="button"
            onClick={() => setPaymentSheetOpen(true)}
            className="text-xs font-bold text-primary-600 hover:text-primary-800"
          >
            {isTe ? 'మార్చండి' : 'Change'}
          </button>
        </div>

        {/* Selected Payment Tile */}
        <div
          onClick={() => setPaymentSheetOpen(true)}
          className="p-3 rounded-xl border-2 border-primary-600 bg-primary-50/50 flex items-center justify-between gap-3 shadow-xs cursor-pointer hover:bg-primary-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0">
              {selectedMethod === 'COD' && <Banknote className="w-5 h-5" />}
              {selectedMethod === 'CARD' && <CreditCard className="w-5 h-5" />}
              {selectedMethod === 'UPI' && <Smartphone className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-extrabold text-ink-900">
                {selectedMethod === 'COD' &&
                  (isTe ? 'నగదు చెల్లింపు (COD)' : 'Cash on Delivery (COD)')}
                {selectedMethod === 'CARD' &&
                  (isTe ? 'క్రెడిట్ / డెబిట్ కార్డు' : 'Credit / Debit Card')}
                {selectedMethod === 'UPI' && (isTe ? 'తక్షణ యూపీఐ (UPI)' : 'Instant UPI')}
              </p>
              <p className="text-[11px] text-ink-600 leading-tight">
                {selectedMethod === 'COD' &&
                  (isTe ? 'ఆర్డర్ అందుకున్నప్పుడు చెల్లించండి' : 'Pay cash or UPI upon handover')}
                {selectedMethod === 'CARD' &&
                  (isTe ? 'వీసా, మాస్టర్‌కార్డ్, రూపే మద్దతు ఉంది' : 'Visa, Mastercard, RuPay')}
                {selectedMethod === 'UPI' &&
                  (isTe ? 'GPay, PhonePe, Paytm, BHIM' : 'Google Pay, PhonePe, Paytm')}
              </p>
            </div>
          </div>
          <div className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        </div>

        {isCodDisabled && (
          <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium">
            {isTe
              ? '₹2,000 పైబడిన ఆర్డర్లకు నగదు చెల్లింపు (COD) అనుమతించబడదు.'
              : 'Cash on Delivery is disabled for orders over ₹2,000. Please choose Card or UPI.'}
          </p>
        )}
      </Card>

      {/* Bill Summary */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white space-y-2.5">
        <h3 className="text-xs font-extrabold text-ink-900 uppercase tracking-wide">
          {isTe ? 'బిల్లు వివరాలు' : 'Bill Details'}
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-ink-700">
            <span>
              {isTe ? 'వస్తువుల మొత్తం' : 'Items Subtotal'} ({items.length}{' '}
              {isTe ? 'వస్తువులు' : 'items'})
            </span>
            <span className="font-bold">{formatPaise(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-ink-700">
            <span>{isTe ? 'డెలివరీ రుసుము' : 'Delivery Fee'}</span>
            {deliveryFee === 0 ? (
              <span className="font-extrabold text-emerald-600">{isTe ? 'ఉచితం' : 'FREE'}</span>
            ) : (
              <span className="font-bold">{formatPaise(deliveryFee)}</span>
            )}
          </div>

          {savings > 0 && (
            <div className="flex items-center justify-between text-accent-700 font-semibold">
              <span>{isTe ? 'ఎంఆర్పీ పొదుపు' : 'MRP Savings'}</span>
              <span>-{formatPaise(savings)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-ink-100 flex items-center justify-between text-sm font-black text-ink-900">
            <span>{isTe ? 'చెల్లించవలసిన మొత్తం' : 'To Pay'}</span>
            <span className="text-base text-primary-700">{formatPaise(total)}</span>
          </div>
        </div>
      </Card>

      {/* Error Notice */}
      {orderError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-900 font-semibold">{orderError}</p>
        </div>
      )}

      {/* Sticky Place Order CTA */}
      <aside
        aria-label="Order placement action"
        className="fixed bottom-16 left-0 right-0 z-35 max-w-md mx-auto px-4 pointer-events-none"
      >
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-ink-200 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
              {isTe ? 'మొత్తం' : 'Amount to Pay'}
            </span>
            <span className="text-base font-black text-ink-900 leading-tight">
              {formatPaise(total)}
            </span>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!canPlaceOrder || submitting}
            onClick={handleCheckoutCta}
            className="flex-1 font-extrabold text-sm min-h-[48px] shadow-md flex items-center justify-center gap-1.5"
          >
            <span>
              {submitting
                ? isTe
                  ? 'ప్రక్రియ...'
                  : 'Placing Order...'
                : isOutsideDeliveryRadius
                  ? isTe
                    ? 'పరిధి వెలుపల'
                    : 'Outside Radius'
                  : selectedMethod === 'CARD'
                    ? isTe
                      ? `కార్డుతో చెల్లించండి · ${formatPaise(total)}`
                      : `Pay by Card · ${formatPaise(total)}`
                    : selectedMethod === 'UPI'
                      ? isTe
                        ? `యూపీఐతో చెల్లించండి · ${formatPaise(total)}`
                        : `Pay via UPI · ${formatPaise(total)}`
                      : isTe
                        ? `ఆర్డర్ ఇవ్వండి (COD) · ${formatPaise(total)}`
                        : `Place Order · ${formatPaise(total)}`}
            </span>
            {!submitting && <ChevronRight className="w-4 h-4 stroke-[2.5]" />}
          </Button>
        </div>
      </aside>

      {/* Payment Method BottomSheet Picker */}
      <BottomSheet
        isOpen={paymentSheetOpen}
        onClose={() => setPaymentSheetOpen(false)}
        title={isTe ? 'చెల్లింపు పద్ధతిని ఎంచుకోండి' : 'Choose Payment Method'}
      >
        <div className="space-y-3 pb-4">
          {/* 1. Cash on Delivery */}
          <div
            onClick={() => {
              if (!isCodDisabled) {
                setSelectedMethod('COD');
                setPaymentSheetOpen(false);
              }
            }}
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
              isCodDisabled
                ? 'opacity-50 bg-ink-50 border-ink-200 cursor-not-allowed'
                : selectedMethod === 'COD'
                  ? 'border-primary-600 bg-primary-50/60 ring-2 ring-primary-100 cursor-pointer'
                  : 'border-ink-200 bg-white hover:border-ink-300 cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedMethod === 'COD' && !isCodDisabled
                    ? 'bg-primary-600 text-white'
                    : 'bg-ink-100 text-ink-600'
                }`}
              >
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-ink-900">
                    {isTe ? 'నగదు చెల్లింపు (Cash on Delivery)' : 'Cash on Delivery (COD)'}
                  </span>
                </div>
                <p className="text-[11px] text-ink-500 mt-0.5 leading-snug">
                  {isCodDisabled
                    ? isTe
                      ? '₹2,000 పైబడిన ఆర్డర్లకు అందుబాటులో లేదు'
                      : 'Unavailable for orders above ₹2,000'
                    : isTe
                      ? 'డెలివరీ లేదా పికప్ సమయంలో చెల్లించండి'
                      : 'Pay cash or UPI upon handover'}
                </p>
              </div>
            </div>
            {selectedMethod === 'COD' && !isCodDisabled && (
              <div className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            )}
          </div>

          {/* 2. Credit / Debit Card */}
          <div
            onClick={() => {
              setSelectedMethod('CARD');
              setPaymentSheetOpen(false);
            }}
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
              selectedMethod === 'CARD'
                ? 'border-primary-600 bg-primary-50/60 ring-2 ring-primary-100'
                : 'border-ink-200 bg-white hover:border-ink-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedMethod === 'CARD'
                    ? 'bg-primary-600 text-white'
                    : 'bg-ink-100 text-ink-600'
                }`}
              >
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-ink-900 block">
                  {isTe ? 'క్రెడిట్ / డెబిట్ కార్డు' : 'Credit / Debit Card'}
                </span>
                <p className="text-[11px] text-ink-500 mt-0.5 leading-snug">
                  {isTe
                    ? 'వీసా, మాస్టర్‌కార్డ్, రూపే మద్దతు ఉంది'
                    : 'Visa, Mastercard, RuPay accepted'}
                </p>
              </div>
            </div>
            {selectedMethod === 'CARD' && (
              <div className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            )}
          </div>

          {/* 3. UPI */}
          <div
            onClick={() => {
              setSelectedMethod('UPI');
              setPaymentSheetOpen(false);
            }}
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
              selectedMethod === 'UPI'
                ? 'border-primary-600 bg-primary-50/60 ring-2 ring-primary-100'
                : 'border-ink-200 bg-white hover:border-ink-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedMethod === 'UPI' ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600'
                }`}
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-ink-900 block">
                  {isTe ? 'తక్షణ యూపీఐ (Instant UPI)' : 'Instant UPI'}
                </span>
                <p className="text-[11px] text-ink-500 mt-0.5 leading-snug">
                  {isTe ? 'Google Pay, PhonePe, Paytm, BHIM' : 'Google Pay, PhonePe, Paytm, BHIM'}
                </p>
              </div>
            </div>
            {selectedMethod === 'UPI' && (
              <div className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Address Selection BottomSheet */}
      <BottomSheet
        isOpen={addressSheetOpen}
        onClose={() => setAddressSheetOpen(false)}
        title={isTe ? 'డెలివరీ చిరునామా ఎంచుకోండి' : 'Select Delivery Address'}
      >
        <div className="space-y-3 pb-4">
          {addresses.map((addr) => {
            const isSelected = activeAddress?._id === addr._id;
            return (
              <div
                key={addr._id}
                onClick={() => {
                  selectAddress(addr);
                  setAddressSheetOpen(false);
                }}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-100'
                    : 'border-ink-200 bg-white hover:border-ink-300'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-ink-900">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="text-[9px] font-bold text-primary-700 bg-primary-100 px-1.5 rounded">
                        {isTe ? 'డిఫాల్ట్' : 'Default'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-600 truncate mt-0.5">{addr.line}</p>
                </div>

                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {/* Card Payment Modal */}
      <CardPaymentModal
        isOpen={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        totalPaise={total}
        storeId={String(cartStore.id || cartStore._id)}
        items={items.map((i) => ({
          storeProductId: i.storeProductId,
          qty: i.qty,
        }))}
        fulfilment={fulfilment}
        onSuccess={(paymentId) => {
          setCardModalOpen(false);
          placeOrderWithPayment(paymentId);
        }}
        onChooseAnotherMethod={() => {
          setCardModalOpen(false);
          setPaymentSheetOpen(true);
        }}
      />

      {/* UPI Payment Modal */}
      <UpiPaymentModal
        isOpen={upiModalOpen}
        onClose={() => setUpiModalOpen(false)}
        totalPaise={total}
        storeId={String(cartStore.id || cartStore._id)}
        items={items.map((i) => ({
          storeProductId: i.storeProductId,
          qty: i.qty,
        }))}
        fulfilment={fulfilment}
        onSuccess={(paymentId) => {
          setUpiModalOpen(false);
          placeOrderWithPayment(paymentId);
        }}
      />
    </div>
  );
};
