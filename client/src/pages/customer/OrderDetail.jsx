import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Store as StoreIcon,
  MapPin,
  Phone,
  AlertCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import api from '../../api/axios';
import { useSocket } from '../../context/SocketContext';
import {
  Button,
  Card,
  Skeleton,
  EmptyState,
  BottomSheet,
  Timeline,
  useToast,
} from '../../components/ui';
import { formatPaise } from '../../utils/format';

export const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { socket, registerRefreshListener } = useSocket();
  const { showToast } = useToast();

  const isTe = i18n.language === 'te';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Customer Cancel state
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Changed my mind');
  const [cancelling, setCancelling] = useState(false);

  // Responding to changes (AWAITING_CUSTOMER)
  const [responding, setResponding] = useState(false);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(null);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data.order);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load order details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Socket and focus listener for live updates
  useEffect(() => {
    const unregister = registerRefreshListener(() => {
      fetchOrder();
    });
    return unregister;
  }, [registerRefreshListener, fetchOrder]);

  useEffect(() => {
    if (!socket) return;
    const handleStatus = (updatedOrder) => {
      if (String(updatedOrder?._id) === String(id) || updatedOrder?.orderNo === id) {
        setOrder(updatedOrder);
      }
    };
    socket.on('order:status', handleStatus);
    socket.on('order:items-changed', handleStatus);
    return () => {
      socket.off('order:status', handleStatus);
      socket.off('order:items-changed', handleStatus);
    };
  }, [socket, id]);

  // Countdown timer for AWAITING_CUSTOMER expiry
  useEffect(() => {
    if (order?.status !== 'AWAITING_CUSTOMER' || !order?.expiresAt) {
      setTimeRemainingSeconds(null);
      return;
    }

    const calcRemaining = () => {
      const diff = Math.max(0, Math.floor((new Date(order.expiresAt) - new Date()) / 1000));
      return diff;
    };

    setTimeRemainingSeconds(calcRemaining());

    const interval = setInterval(() => {
      const remaining = calcRemaining();
      setTimeRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        fetchOrder();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order?.status, order?.expiresAt, fetchOrder]);

  // Respond to item changes (accept or cancel)
  const handleRespondChanges = async (accept) => {
    try {
      setResponding(true);
      const res = await api.patch(`/orders/${order._id || id}/respond-changes`, {
        accept,
      });
      setOrder(res.data.order);
      showToast({
        type: 'success',
        message: isTe ? 'మీ స్పందన నమోదు చేయబడింది.' : 'Response updated successfully.',
      });
    } catch (err) {
      showToast({
        type: 'error',
        message:
          err.response?.data?.message ||
          (isTe ? 'ప్రతిస్పందన నవీకరణ విఫలమైంది.' : 'Failed to update order response.'),
      });
      fetchOrder();
    } finally {
      setResponding(false);
    }
  };

  // Cancel order handler
  const handleCancelOrder = async () => {
    try {
      setCancelling(true);
      await api.patch(`/orders/${order._id || id}/cancel`, {
        reason: cancelReason,
      });
      setCancelSheetOpen(false);
      showToast({
        type: 'success',
        message: isTe ? 'ఆర్డర్ విజయవంతంగా రద్దు చేయబడింది.' : 'Order cancelled successfully.',
      });
      fetchOrder();
    } catch (err) {
      showToast({
        type: 'error',
        message:
          err.response?.data?.message ||
          (isTe ? 'ఆర్డర్ రద్దు చేయడం విఫలమైంది.' : 'Failed to cancel order.'),
      });
    } finally {
      setCancelling(false);
    }
  };

  // Reorder handler
  const handleReorder = () => {
    if (!order) return;
    // Redirect to store page so customer can view current products
    const storeId = order.store?._id || order.store;
    if (storeId) {
      navigate(`/app/store/${storeId}`);
    } else {
      navigate('/app');
    }
  };

  // Build Timeline steps
  const timelineSteps = useMemo(() => {
    if (!order) return [];

    const isPickup = order.fulfilment === 'pickup';
    const status = order.status;

    // Map status to currentIndex in timeline
    let currentIndex = 0;
    if (status === 'PLACED') currentIndex = 0;
    else if (status === 'ACCEPTED' || status === 'AWAITING_CUSTOMER') currentIndex = 1;
    else if (status === 'PACKING') currentIndex = 2;
    else if (status === 'READY') currentIndex = 3;
    else if (status === 'OUT_FOR_DELIVERY') currentIndex = 4;
    else if (status === 'DELIVERED') currentIndex = isPickup ? 4 : 5;

    // Check if terminal state
    const isTerminalFailed = ['REJECTED', 'CANCELLED', 'EXPIRED', 'DELIVERY_FAILED'].includes(
      status,
    );

    const stepLabels = isPickup
      ? [
          {
            id: 'PLACED',
            label: isTe ? 'ఆర్డర్ ఉంచబడింది' : 'Order Placed',
            desc: isTe ? 'దుకాణదారుడి ఆమోదం కోసం వేచి ఉంది' : 'Sent to store',
          },
          {
            id: 'ACCEPTED',
            label: isTe ? 'ఆమోదించబడింది' : 'Order Accepted',
            desc: isTe ? 'దుకాణదారుడు ఆమోదించారు' : 'Store confirmed order',
          },
          {
            id: 'PACKING',
            label: isTe ? 'ప్యాకింగ్ అవుతోంది' : 'Packing Items',
            desc: isTe ? 'వస్తువులు సిద్ధం చేస్తున్నారు' : 'Items being packed',
          },
          {
            id: 'READY',
            label: isTe ? 'పికప్‌కు సిద్ధం' : 'Ready for Pickup',
            desc: isTe ? 'దుకాణం వద్ద తీసుకోవచ్చు' : 'Ready at store counter',
          },
          {
            id: 'DELIVERED',
            label: isTe ? 'పూర్తయింది' : 'Handed Over',
            desc: isTe ? 'కస్టమర్‌కు అందజేయబడింది' : 'Order collected',
          },
        ]
      : [
          {
            id: 'PLACED',
            label: isTe ? 'ఆర్డర్ ఉంచబడింది' : 'Order Placed',
            desc: isTe ? 'దుకాణదారుడి ఆమోదం కోసం వేచి ఉంది' : 'Sent to store',
          },
          {
            id: 'ACCEPTED',
            label: isTe ? 'ఆమోదించబడింది' : 'Order Accepted',
            desc: isTe ? 'దుకాణదారుడు ఆమోదించారు' : 'Store confirmed order',
          },
          {
            id: 'PACKING',
            label: isTe ? 'ప్యాకింగ్ అవుతోంది' : 'Packing Items',
            desc: isTe ? 'వస్తువులు సిద్ధం చేస్తున్నారు' : 'Items being packed',
          },
          {
            id: 'READY',
            label: isTe ? 'సిద్ధమైంది' : 'Order Ready',
            desc: isTe ? 'డెలివరీకి సిద్ధంగా ఉంది' : 'Packed and inspected',
          },
          {
            id: 'OUT_FOR_DELIVERY',
            label: isTe ? 'డెలివరీలో ఉంది' : 'Out for Delivery',
            desc: isTe ? 'మీ చిరునామాకు వస్తోంది' : 'On the way to you',
          },
          {
            id: 'DELIVERED',
            label: isTe ? 'డెలివరీ పూర్తయింది' : 'Delivered',
            desc: isTe ? 'ఆర్డర్ విజయవంతంగా చేరింది' : 'Order completed',
          },
        ];

    return stepLabels.map((s, idx) => {
      let stepStatus = 'pending';
      if (!isTerminalFailed) {
        if (idx < currentIndex) stepStatus = 'done';
        else if (idx === currentIndex) stepStatus = 'current';
      } else {
        // If failed, steps up to last reached
        stepStatus = 'pending';
      }

      // Add timestamp note if matching status history
      const histMatch = order.statusHistory?.find((h) => h.status === s.id);
      const timeStr = histMatch
        ? new Date(histMatch.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : undefined;

      return {
        id: s.id,
        label: s.label,
        description: s.desc,
        status: stepStatus,
        time: timeStr,
      };
    });
  }, [order, isTe]);

  if (loading) {
    return (
      <div className="space-y-4 pt-2 animate-pulse pb-20">
        <div className="h-6 w-32 bg-ink-200 rounded-lg" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="pt-8">
        <EmptyState
          icon={AlertCircle}
          title={isTe ? 'ఆర్డర్ కనుగొనబడలేదు' : 'Order Not Found'}
          description={
            error || (isTe ? 'ఆర్డర్ వివరాలు అందుబాటులో లేవు.' : 'Unable to locate order details.')
          }
          actionLabel={isTe ? 'హోమ్‌కు వెళ్లండి' : 'Back to Home'}
          onAction={() => navigate('/app')}
        />
      </div>
    );
  }

  // Cancel button rule: Cancel button only allowed before Packing (PLACED, ACCEPTED, or AWAITING_CUSTOMER)
  const canCancel = ['PLACED', 'ACCEPTED', 'AWAITING_CUSTOMER'].includes(order.status);

  // Terminal state check
  const isFailedTerminal = ['REJECTED', 'CANCELLED', 'EXPIRED', 'DELIVERY_FAILED'].includes(
    order.status,
  );

  const unavailableItems = order.items.filter((i) => i.available === false);

  const formatCountdown = (seconds) => {
    if (seconds == null || seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1">
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="flex items-center gap-1.5 text-xs font-bold text-ink-700 hover:text-ink-900 bg-white border border-ink-200 px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isTe ? 'హోమ్' : 'Home'}</span>
        </button>

        <span className="text-xs font-black text-ink-600">Order #{order.orderNo}</span>
      </div>

      {/* ITEMS CHANGED BANNER (Awaiting Customer confirmation) */}
      {order.status === 'AWAITING_CUSTOMER' && (
        <Card className="p-4 bg-amber-50 border-2 border-amber-400 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5 animate-bounce" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-amber-950">
                  {isTe ? 'ఆర్డర్‌లో మార్పులు జరిగాయి' : 'Items Unavailable in Order'}
                </h3>
                {timeRemainingSeconds != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-200 text-amber-900 font-mono font-bold text-xs rounded-lg">
                    <Clock className="w-3.5 h-3.5" />
                    {formatCountdown(timeRemainingSeconds)}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-800 mt-1 leading-snug">
                {isTe
                  ? 'కొన్ని వస్తువులు దుకాణంలో లేకపోవడం వల్ల తొలగించబడ్డాయి. కొత్త మొత్తాన్ని పరిశీలించి 10 నిమిషాల్లో ఆమోదించండి:'
                  : 'Some items are out of stock and were removed. Please review the updated total and respond within 10 minutes:'}
              </p>
            </div>
          </div>

          {/* List of removed items */}
          {unavailableItems.length > 0 && (
            <div className="p-2.5 bg-white/80 rounded-xl border border-amber-200 space-y-1 text-xs">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                {isTe ? 'తొలగించబడిన వస్తువులు:' : 'Unavailable Items:'}
              </span>
              {unavailableItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between text-amber-950 font-medium line-through"
                >
                  <span>
                    {isTe && item.nameTe ? item.nameTe : item.name} ({item.qty} {item.unit})
                  </span>
                  <span>{formatPaise(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-amber-200/70 text-xs">
            <span className="font-bold text-amber-950">
              {isTe ? 'కొత్త మొత్తం (New Total):' : 'Updated Total:'}
            </span>
            <span className="text-base font-black text-amber-950">{formatPaise(order.total)}</span>
          </div>

          {/* Accept / Decline Action Buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={responding}
              onClick={() => handleRespondChanges(false)}
              className="flex-1 text-xs font-bold text-red-700 border-red-200 bg-white hover:bg-red-50 min-h-[44px]"
            >
              {isTe ? 'ఆర్డర్ రద్దు చేయి' : 'Cancel Order'}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={responding}
              onClick={() => handleRespondChanges(true)}
              className="flex-1 text-xs font-extrabold bg-emerald-700 hover:bg-emerald-800 min-h-[44px] shadow-sm"
            >
              {responding ? '...' : isTe ? 'మార్పులను ఆమోదించు' : 'Accept Changes'}
            </Button>
          </div>
        </Card>
      )}

      {/* TERMINAL STATE BANNER (Failed / Cancelled / Rejected) */}
      {isFailedTerminal && (
        <Card className="p-4 bg-red-50 border border-red-200 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-extrabold text-red-950">
                {order.status === 'REJECTED' &&
                  (isTe ? 'దుకాణదారుడు తిరస్కరించారు' : 'Order Declined by Store')}
                {order.status === 'CANCELLED' &&
                  (isTe ? 'ఆర్డర్ రద్దు చేయబడింది' : 'Order Cancelled')}
                {order.status === 'EXPIRED' &&
                  (isTe ? 'ఆర్డర్ గడువు ముగిసింది' : 'Order Request Expired')}
                {order.status === 'DELIVERY_FAILED' &&
                  (isTe ? 'డెలివరీ విఫలమైంది' : 'Delivery Failed')}
              </h3>
              {order.rejectReason && (
                <p className="text-xs text-red-800 mt-1">
                  <span className="font-semibold">{isTe ? 'కారణం:' : 'Reason:'}</span>{' '}
                  {order.rejectReason}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-red-200/60">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleReorder}
              className="w-full flex items-center justify-center gap-2 font-bold text-xs min-h-[46px] bg-red-600 hover:bg-red-700 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{isTe ? 'మళ్ళీ ఆర్డర్ చేయండి (Reorder)' : 'Reorder Items'}</span>
            </Button>
          </div>
        </Card>
      )}

      {/* DELIVERED SUCCESS BANNER */}
      {order.status === 'DELIVERED' && (
        <Card className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-emerald-950">
                {order.fulfilment === 'pickup'
                  ? isTe
                    ? 'ఆర్డర్ విజయవంతంగా తీసుకున్నారు!'
                    : 'Order Handed Over!'
                  : isTe
                    ? 'ఆర్డర్ విజయవంతంగా డెలివరీ అయింది!'
                    : 'Order Delivered!'}
              </h3>
              <p className="text-xs text-emerald-800">
                {isTe ? 'మా వద్ద కొనుగోలు చేసినందుకు ధన్యవాదాలు.' : 'Thank you for shopping local!'}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReorder}
            className="text-emerald-800 font-bold text-xs hover:bg-emerald-100"
          >
            {isTe ? 'మళ్ళీ కొనండి' : 'Reorder'}
          </Button>
        </Card>
      )}

      {/* LIVE TIMELINE TRACKING */}
      {!isFailedTerminal && (
        <Card className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-ink-100">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              {isTe ? 'ఆర్డర్ ట్రాకింగ్' : 'Live Order Tracking'}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>

          <Timeline steps={timelineSteps} className="pt-2" />
        </Card>
      )}

      {/* Store Card with Call Store */}
      <Card className="p-3.5 border border-ink-200 rounded-2xl bg-white flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0 border border-primary-100">
            <StoreIcon className="w-5 h-5 stroke-[2]" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wide">
              {isTe ? 'దుకాణం' : 'Store'}
            </span>
            <h3 className="text-sm font-extrabold text-ink-900 truncate">{order.store?.name}</h3>
            <p className="text-[11px] text-ink-500 truncate">{order.store?.address}</p>
          </div>
        </div>

        {order.store?.phone && (
          <a
            href={`tel:${order.store.phone}`}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-xl border border-emerald-200 font-bold text-xs transition-colors shrink-0 shadow-xs active:scale-95"
            title="Call Store"
          >
            <Phone className="w-4 h-4 fill-emerald-700" />
            <span>{isTe ? 'కాల్' : 'Call'}</span>
          </a>
        )}
      </Card>

      {/* Items Ordered List */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white space-y-3 shadow-xs">
        <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
          {isTe ? 'ఆర్డర్ చేసిన వస్తువులు' : 'Items Ordered'} ({order.items.length})
        </h3>

        <div className="divide-y divide-ink-100">
          {order.items.map((item, idx) => {
            const isAvailable = item.available !== false;
            return (
              <div
                key={idx}
                className={`py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs ${
                  !isAvailable ? 'opacity-40 line-through' : ''
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-extrabold text-ink-900 leading-snug line-clamp-1">
                    {isTe && item.nameTe ? item.nameTe : item.name}
                  </p>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    {item.qty} × {formatPaise(item.price)} ({item.unit})
                    {!isAvailable && (
                      <span className="ml-2 font-bold text-red-600 no-underline">
                        ({isTe ? 'అందుబాటులో లేదు' : 'Unavailable'})
                      </span>
                    )}
                  </p>
                </div>

                <span className="font-extrabold text-ink-900 shrink-0">
                  {formatPaise(item.price * item.qty)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Fulfilment & Delivery Address */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white space-y-2 shadow-xs">
        <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
          {isTe ? 'డెలివరీ విధానం' : 'Fulfilment'}
        </span>

        {order.fulfilment === 'delivery' ? (
          <div className="flex items-start gap-2 pt-1 text-xs">
            <MapPin className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-ink-900">
                {isTe ? 'ఇంటి వద్దకు డెలివరీ' : 'Home Delivery'} (
                {order.addressSnapshot?.label || 'Address'})
              </p>
              <p className="text-ink-600 leading-snug">{order.addressSnapshot?.line}</p>
              {order.addressSnapshot?.landmark && (
                <p className="text-ink-500 text-[11px] mt-0.5">
                  {isTe ? 'గుర్తు: ' : 'Landmark: '} {order.addressSnapshot.landmark} •{' '}
                  {order.addressSnapshot.pincode}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1 text-xs text-ink-800 font-bold">
            <StoreIcon className="w-4 h-4 text-primary-600 shrink-0" />
            <span>
              {isTe ? 'దుకాణం వద్ద పికప్' : 'Store Pickup at'} {order.store?.name}
            </span>
          </div>
        )}
      </Card>

      {/* Bill & Payment Status Details */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white space-y-2.5 shadow-xs">
        <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
          {isTe ? 'బిల్లు వివరాలు' : 'Bill Details'}
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-ink-700">
            <span>{isTe ? 'వస్తువుల సబ్‌టోటల్' : 'Item Subtotal'}</span>
            <span className="font-bold">{formatPaise(order.subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-ink-700">
            <span>{isTe ? 'డెలివరీ ఛార్జీ' : 'Delivery Fee'}</span>
            <span className="font-bold">
              {order.deliveryFee === 0 ? (isTe ? 'ఉచితం' : 'FREE') : formatPaise(order.deliveryFee)}
            </span>
          </div>

          <div className="pt-2 border-t border-ink-100 flex items-center justify-between text-sm font-black text-ink-900">
            <div>
              <span>
                {isTe ? 'మొత్తం' : 'Total'} ({order.paymentMethod})
              </span>
              <p className="text-[10px] font-semibold text-ink-500">
                {isTe ? 'చెల్లింపు స్థితి: ' : 'Status: '}
                <span
                  className={
                    order.paymentStatus === 'SUCCESS' ? 'text-emerald-700' : 'text-amber-700'
                  }
                >
                  {order.paymentStatus === 'SUCCESS'
                    ? isTe
                      ? 'చెల్లించబడింది'
                      : 'Paid'
                    : order.paymentStatus === 'REFUNDED'
                      ? isTe
                        ? 'రీఫండ్ చేయబడింది'
                        : 'Refunded'
                      : order.paymentStatus === 'PARTIALLY_REFUNDED'
                        ? isTe
                          ? 'పాక్షికంగా రీఫండ్ చేయబడింది'
                          : 'Partially Refunded'
                        : isTe
                          ? 'నగదు చెల్లించాలి'
                          : 'Pay on Delivery'}
                </span>
              </p>
            </div>
            <span className="text-base text-primary-700">{formatPaise(order.total)}</span>
          </div>

          {(order.paymentStatus === 'REFUNDED' || order.paymentStatus === 'PARTIALLY_REFUNDED') && (
            <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
              <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="font-extrabold">
                  {order.paymentStatus === 'PARTIALLY_REFUNDED'
                    ? isTe
                      ? `పాక్షిక రీఫండ్: ${formatPaise(order.refundAmount || 0)}`
                      : `Partial Refund: ${formatPaise(order.refundAmount || 0)}`
                    : isTe
                      ? `పూర్తి రీఫండ్: ${formatPaise(order.refundAmount || order.total)}`
                      : `Full Refund: ${formatPaise(order.refundAmount || order.total)}`}
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                  {isTe
                    ? 'రీఫండ్ ప్రారంభించబడింది, 3-5 రోజులు పడుతుంది'
                    : 'Refund initiated, takes 3-5 days'}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Cancel Order Button (Only allowed before Packing) */}
      {canCancel && (
        <div className="pt-2">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => setCancelSheetOpen(true)}
            className="w-full text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 min-h-[44px]"
          >
            {isTe ? 'ఆర్డర్ రద్దు చేయండి' : 'Cancel Order'}
          </Button>
        </div>
      )}

      {/* Cancel Confirmation BottomSheet */}
      <BottomSheet
        isOpen={cancelSheetOpen}
        onClose={() => setCancelSheetOpen(false)}
        title={isTe ? 'ఆర్డర్ రద్దు చేయాలా?' : 'Cancel Order?'}
      >
        <div className="space-y-4 pb-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-2xl">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
            <p className="text-xs text-red-900 leading-snug">
              {isTe
                ? `మీరు ఆర్డర్ #${order.orderNo} ని ఖచ్చితంగా రద్దు చేయాలనుకుంటున్నారా?`
                : `Are you sure you want to cancel order #${order.orderNo}? This cannot be undone.`}
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <label className="font-bold text-ink-800">
              {isTe ? 'రద్దు చేయడానికి కారణం' : 'Reason for cancellation'}
            </label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-2.5 bg-white border border-ink-200 rounded-xl"
            >
              <option value="Changed my mind">
                {isTe ? 'నా అభిప్రాయం మార్చుకున్నాను' : 'Changed my mind'}
              </option>
              <option value="Ordered by mistake">
                {isTe ? 'పొరపాటున ఆర్డర్ చేశాను' : 'Ordered by mistake'}
              </option>
              <option value="Delivery time is too long">
                {isTe ? 'డెలివరీ సమయం ఎక్కువ' : 'Delivery time is too long'}
              </option>
              <option value="Want to change items or address">
                {isTe ? 'వస్తువులు లేదా చిరునామా మార్చాలి' : 'Want to change items or address'}
              </option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setCancelSheetOpen(false)}
              className="flex-1 text-xs font-bold min-h-[48px]"
            >
              {isTe ? 'ఆర్డర్ ఉంచండి' : 'Keep Order'}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              disabled={cancelling}
              onClick={handleCancelOrder}
              className="flex-1 text-xs font-bold min-h-[48px]"
            >
              {cancelling
                ? isTe
                  ? 'రద్దు చేస్తోంది...'
                  : 'Cancelling...'
                : isTe
                  ? 'ఖచ్చితంగా రద్దు చేయి'
                  : 'Confirm Cancel'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
