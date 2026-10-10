import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Clock,
  Check,
  AlertTriangle,
  AlertCircle,
  Store as StoreIcon,
  MoreVertical,
} from 'lucide-react';
import api from '../../api/axios';
import { useSocket } from '../../context/SocketContext';
import {
  Button,
  Card,
  Badge,
  Skeleton,
  EmptyState,
  BottomSheet,
  useToast,
} from '../../components/ui';
import { formatPaise } from '../../utils/format';

export const StoreOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { socket, registerRefreshListener } = useSocket();
  const { showToast } = useToast();

  const isTe = i18n.language === 'te';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Packed checklist state (item id / index -> boolean)
  const [packedItems, setPackedItems] = useState({});

  // Item menu / mark unavailable sheet
  const [itemActionSheetOpen, setItemActionSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // COD Payment collection sheet
  const [codSheetOpen, setCodSheetOpen] = useState(false);
  const [codActionPending, setCodActionPending] = useState(null); // 'handover' or 'delivered'

  // Delivery failed sheet
  const [failSheetOpen, setFailSheetOpen] = useState(false);
  const [failReason, setFailReason] = useState('Customer unreachable');

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/store/orders/${id}`);
      setOrder(res.data.order);
    } catch (err) {
      if (err.response?.status === 409) {
        // 409: treat as already updated, refresh
        return;
      }
      setError(err.response?.data?.message || 'Could not load order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Socket and focus listener
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

  const togglePacked = (itemId) => {
    setPackedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // Helper for safe transitions handling 409
  const handleTransition = async (actionFn) => {
    try {
      setActionLoading(true);
      await actionFn();
      await fetchOrder();
    } catch (err) {
      if (err.response?.status === 409) {
        // Treat 409 as already updated, just refresh
        await fetchOrder();
      } else {
        showToast({
          type: 'error',
          message:
            err.response?.data?.message ||
            (isTe
              ? 'చర్య విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.'
              : 'Operation failed. Please try again.'),
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Status step progression handler
  const handleNextStep = async () => {
    if (!order) return;

    if (order.status === 'PLACED') {
      await handleTransition(() => api.patch(`/store/orders/${order._id}/accept`));
    } else if (order.status === 'ACCEPTED') {
      await handleTransition(() =>
        api.patch(`/store/orders/${order._id}/status`, {
          to: 'PACKING',
          expectedStatus: 'ACCEPTED',
          note: 'Started packing',
        }),
      );
    } else if (order.status === 'PACKING') {
      await handleTransition(() =>
        api.patch(`/store/orders/${order._id}/status`, {
          to: 'READY',
          expectedStatus: 'PACKING',
          note: 'Order is packed and ready',
        }),
      );
    } else if (order.status === 'READY') {
      if (order.fulfilment === 'delivery') {
        await handleTransition(() =>
          api.patch(`/store/orders/${order._id}/status`, {
            to: 'OUT_FOR_DELIVERY',
            expectedStatus: 'READY',
            note: 'Out for delivery',
          }),
        );
      } else {
        // Pickup -> Handed over (DELIVERED)
        if (order.paymentMethod === 'COD' && order.paymentStatus !== 'SUCCESS') {
          setCodActionPending('handover');
          setCodSheetOpen(true);
        } else {
          await handleTransition(() =>
            api.patch(`/store/orders/${order._id}/status`, {
              to: 'DELIVERED',
              expectedStatus: 'READY',
              note: 'Order handed over to customer',
            }),
          );
        }
      }
    } else if (order.status === 'OUT_FOR_DELIVERY') {
      // Delivery -> DELIVERED
      if (order.paymentMethod === 'COD' && order.paymentStatus !== 'SUCCESS') {
        setCodActionPending('delivered');
        setCodSheetOpen(true);
      } else {
        await handleTransition(() =>
          api.patch(`/store/orders/${order._id}/status`, {
            to: 'DELIVERED',
            expectedStatus: 'OUT_FOR_DELIVERY',
            note: 'Order delivered',
          }),
        );
      }
    }
  };

  // Confirm COD Payment Collected
  const handleConfirmCod = async (collected) => {
    setCodSheetOpen(false);
    if (!collected) {
      showToast({
        type: 'warning',
        message: isTe
          ? 'ఆర్డర్ పూర్తి చేయడానికి ముందు నగదు స్వీకరించాలి.'
          : 'Payment must be collected before completing the order.',
      });
      return;
    }

    await handleTransition(async () => {
      // Record payment collected
      await api.patch(`/store/orders/${order._id}/payment-collected`);
      // Update order status to DELIVERED
      const expectedStatus = codActionPending === 'handover' ? 'READY' : 'OUT_FOR_DELIVERY';
      await api.patch(`/store/orders/${order._id}/status`, {
        to: 'DELIVERED',
        expectedStatus,
        note: 'Payment collected and order completed',
      });
    });
  };

  // Mark Item Unavailable
  const handleMarkUnavailable = async () => {
    if (!selectedItem) return;
    setItemActionSheetOpen(false);
    const targetId = selectedItem.storeProductId || selectedItem._id;
    await handleTransition(() =>
      api.patch(`/store/orders/${order._id}/items/${targetId}/unavailable`),
    );
  };

  // Delivery Failed
  const handleDeliveryFailed = async () => {
    setFailSheetOpen(false);
    await handleTransition(() =>
      api.patch(`/store/orders/${order._id}/delivery-failed`, {
        reason: failReason,
      }),
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 pt-2 pb-24">
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
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
            error || (isTe ? 'ఈ ఆర్డర్ వివరాలు అందుబాటులో లేవు.' : 'Order details not found.')
          }
          actionLabel={isTe ? 'ఆర్డర్ల జాబితాకు వెళ్లండి' : 'Back to Orders'}
          onAction={() => navigate('/store/orders')}
        />
      </div>
    );
  }

  // Next step button label and state
  const getNextStepConfig = () => {
    switch (order.status) {
      case 'PLACED':
        return {
          label: isTe ? 'ఆర్డర్ అంగీకరించు (Accept)' : 'Accept Order',
          action: handleNextStep,
          variant: 'primary',
          disabled: false,
        };
      case 'ACCEPTED':
        return {
          label: isTe ? 'ప్యాకింగ్ ప్రారంభించు (Start Packing)' : 'Start Packing',
          action: handleNextStep,
          variant: 'primary',
          disabled: false,
        };
      case 'PACKING':
        return {
          label: isTe ? 'రెడీగా మార్క్ చేయి (Mark Ready)' : 'Mark Ready',
          action: handleNextStep,
          variant: 'primary',
          disabled: false,
        };
      case 'READY':
        if (order.fulfilment === 'delivery') {
          return {
            label: isTe ? 'డెలివరీకి పంపు (Out for Delivery)' : 'Out for Delivery',
            action: handleNextStep,
            variant: 'primary',
            disabled: false,
          };
        }
        return {
          label: isTe ? 'కస్టమర్‌కు అందజేయండి (Handed Over)' : 'Handed Over (Pickup)',
          action: handleNextStep,
          variant: 'primary',
          disabled: false,
        };
      case 'OUT_FOR_DELIVERY':
        return {
          label: isTe ? 'డెలివరీ పూర్తయింది (Delivered)' : 'Delivered',
          action: handleNextStep,
          variant: 'primary',
          disabled: false,
        };
      case 'AWAITING_CUSTOMER':
        return {
          label: isTe ? 'కస్టమర్ నిర్ణయం కోసం వేచి చూస్తోంది' : 'Awaiting Customer Response',
          action: () => {},
          variant: 'secondary',
          disabled: true,
        };
      default:
        return null;
    }
  };

  const nextStepConfig = getNextStepConfig();
  const customerPhone = order.customer?.phone;
  const isTerminal = ['DELIVERED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'DELIVERY_FAILED'].includes(
    order.status,
  );

  return (
    <div className="space-y-4 pb-32">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1">
        <button
          type="button"
          onClick={() => navigate('/store/orders')}
          className="flex items-center gap-1.5 text-xs font-bold text-ink-700 hover:text-ink-900 bg-white border border-ink-200 px-3 py-2 rounded-xl shadow-xs active:scale-95 transition-all min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isTe ? 'ఆర్డర్లు' : 'Orders'}</span>
        </button>

        <span className="text-xs font-black text-ink-600 tracking-wide">#{order.orderNo}</span>
      </div>

      {/* Status Notice Banner if Awaiting Customer */}
      {order.status === 'AWAITING_CUSTOMER' && (
        <Card className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-700 shrink-0 animate-pulse" />
          <div className="text-xs text-amber-950 min-w-0">
            <p className="font-extrabold">
              {isTe
                ? 'వస్తువుల మార్పు: కస్టమర్ నిర్ధారణ కోసం వేచి చూస్తోంది (10 నిమిషాలు)'
                : 'Items updated: Awaiting customer confirmation (10 min)'}
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              {isTe
                ? 'కస్టమర్ అంగీకరిస్తే ప్యాకింగ్‌కు మారుతుంది.'
                : 'Will move to PACKING once accepted by customer.'}
            </p>
          </div>
        </Card>
      )}

      {/* Customer Info Card */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">
              {isTe ? 'కస్టమర్' : 'Customer'}
            </span>
            <h2 className="text-base font-extrabold text-ink-900">
              {order.customer?.name || (isTe ? 'కస్టమర్' : 'Customer')}
            </h2>
          </div>

          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200 font-bold text-xs min-h-[48px] active:scale-95 transition-all shadow-xs"
            >
              <Phone className="w-4 h-4 fill-emerald-700" />
              <span>{isTe ? 'కాల్ చేయండి' : 'Call'}</span>
            </a>
          )}
        </div>

        {/* Address / Landmark or Pickup */}
        <div className="pt-2 border-t border-ink-100 text-xs">
          {order.fulfilment === 'delivery' ? (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-ink-900">
                  {order.addressSnapshot?.label || (isTe ? 'ఇంటి చిరునామా' : 'Delivery Address')}
                </p>
                <p className="text-ink-600 leading-snug">{order.addressSnapshot?.line}</p>
                {order.addressSnapshot?.landmark && (
                  <p className="text-ink-500 text-[11px] mt-0.5">
                    {isTe ? 'గుర్తు (Landmark): ' : 'Landmark: '}
                    <span className="font-semibold text-ink-700">
                      {order.addressSnapshot.landmark}
                    </span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-primary-800 font-bold">
              <StoreIcon className="w-4 h-4 text-primary-700 shrink-0" />
              <span>{isTe ? 'దుకాణం వద్ద పికప్ (Store Pickup)' : 'Store Pickup'}</span>
            </div>
          )}
        </div>

        {/* Payment info tag */}
        <div className="pt-2 border-t border-ink-100 flex items-center justify-between text-xs">
          <span className="text-ink-500 font-medium">{isTe ? 'చెల్లింపు' : 'Payment'}</span>
          <div className="flex items-center gap-2">
            <Badge variant={order.paymentMethod === 'COD' ? 'accent' : 'success'}>
              {order.paymentMethod}
            </Badge>
            <span className="font-extrabold text-ink-900">{formatPaise(order.total)}</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                order.paymentStatus === 'SUCCESS'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {order.paymentStatus === 'SUCCESS'
                ? isTe
                  ? 'చెల్లించబడింది'
                  : 'Paid'
                : isTe
                  ? 'వసూలు చేయాలి'
                  : 'Collect'}
            </span>
          </div>
        </div>
      </Card>

      {/* Packing Checklist */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              {isTe ? 'ప్యాకింగ్ చెక్‌లిస్ట్' : 'Packing Checklist'} ({order.items.length})
            </h3>
            <p className="text-[11px] text-ink-400">
              {isTe
                ? 'వస్తువులను సరిచూసి టిక్ చేయండి. లేకపోతే మెనూ ద్వారా అందుబాటులో లేదని మార్క్ చేయండి.'
                : 'Tick packed items. Tap menu to mark unavailable.'}
            </p>
          </div>
        </div>

        <div className="divide-y divide-ink-100">
          {order.items.map((item, idx) => {
            const itemId = item._id || idx;
            const isPacked = !!packedItems[itemId];
            const isAvailable = item.available !== false;

            return (
              <div
                key={itemId}
                className={`py-3 flex items-center justify-between gap-3 ${
                  !isAvailable ? 'opacity-40 line-through bg-ink-50 -mx-4 px-4' : ''
                }`}
              >
                {/* Checkbox for packing */}
                <button
                  type="button"
                  disabled={!isAvailable || isTerminal}
                  onClick={() => togglePacked(itemId)}
                  className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isPacked
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-ink-300 bg-white hover:border-ink-400'
                  }`}
                >
                  {isPacked && <Check className="w-4 h-4 stroke-[3]" />}
                </button>

                {/* Item description */}
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-sm text-ink-900 leading-snug">
                    {item.nameTe || item.name}
                  </p>
                  {item.nameTe && item.name && (
                    <p className="text-[11px] text-ink-500 truncate">{item.name}</p>
                  )}
                  <p className="text-xs text-ink-600 font-semibold mt-0.5">
                    {item.qty} {item.unit} • {formatPaise(item.price * item.qty)}
                  </p>
                </div>

                {/* Unavailable action menu */}
                {isAvailable && !isTerminal && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(item);
                      setItemActionSheetOpen(true);
                    }}
                    className="p-2 text-ink-400 hover:text-ink-700 rounded-lg hover:bg-ink-100 transition-colors shrink-0"
                    title={isTe ? 'ఆప్షన్స్' : 'Options'}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Bill summary */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white space-y-2 text-xs">
        <div className="flex justify-between text-ink-600">
          <span>{isTe ? 'వస్తువుల మొత్తం' : 'Items Subtotal'}</span>
          <span className="font-bold">{formatPaise(order.subtotal)}</span>
        </div>
        <div className="flex justify-between text-ink-600">
          <span>{isTe ? 'డెలివరీ ఛార్జీ' : 'Delivery Fee'}</span>
          <span className="font-bold">
            {order.deliveryFee === 0 ? (isTe ? 'ఉచితం' : 'FREE') : formatPaise(order.deliveryFee)}
          </span>
        </div>
        <div className="pt-2 border-t border-ink-100 flex justify-between text-sm font-black text-ink-900">
          <span>{isTe ? 'మొత్తం' : 'Total'}</span>
          <span className="text-base text-primary-700">{formatPaise(order.total)}</span>
        </div>
      </Card>

      {/* Delivery Failed Trigger (Only when OUT_FOR_DELIVERY) */}
      {order.status === 'OUT_FOR_DELIVERY' && (
        <div className="pt-1">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => setFailSheetOpen(true)}
            className="w-full text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 min-h-[48px]"
          >
            {isTe ? 'డెలివరీ విఫలమైందా? (Delivery Failed)' : 'Delivery Failed'}
          </Button>
        </div>
      )}

      {/* Sticky Bottom Bar with 56px Big Next-Step Button */}
      {nextStepConfig && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-ink-200 z-30 shadow-lg">
          <div className="max-w-md mx-auto">
            <Button
              type="button"
              variant={nextStepConfig.variant}
              disabled={nextStepConfig.disabled || actionLoading}
              onClick={nextStepConfig.action}
              className="w-full min-h-[56px] text-base font-extrabold tracking-wide rounded-2xl shadow-md active:scale-98 transition-all"
            >
              {actionLoading ? (isTe ? 'నవీకరిస్తోంది...' : 'Updating...') : nextStepConfig.label}
            </Button>
          </div>
        </div>
      )}

      {/* Item Action / Mark Unavailable BottomSheet */}
      <BottomSheet
        isOpen={itemActionSheetOpen}
        onClose={() => setItemActionSheetOpen(false)}
        title={isTe ? 'వస్తువు అందుబాటులో లేదా?' : 'Item Unavailable?'}
      >
        <div className="space-y-4 pb-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{selectedItem?.nameTe || selectedItem?.name}</p>
              <p className="mt-1 text-[11px] text-amber-800 leading-snug">
                {isTe
                  ? 'ఈ వస్తువును అందుబాటులో లేదని గుర్తు చేస్తే, ఆర్డర్ మొత్తం తగ్గి కస్టమర్ నిర్ధారణ కోసం పంపబడుతుంది (10 నిమిషాలు).'
                  : 'Marking this item unavailable will recompute the total and send a 10-minute confirmation request to the customer.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setItemActionSheetOpen(false)}
              className="flex-1 min-h-[56px] text-sm font-bold"
            >
              {isTe ? 'రద్దు' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={actionLoading}
              onClick={handleMarkUnavailable}
              className="flex-1 min-h-[56px] text-sm font-bold"
            >
              {actionLoading ? '...' : isTe ? 'అందుబాటులో లేదు' : 'Mark Unavailable'}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* COD Payment Collection Prompt Sheet */}
      <BottomSheet
        isOpen={codSheetOpen}
        onClose={() => setCodSheetOpen(false)}
        title={isTe ? 'నగదు వసూలు అయిందా?' : 'Payment Collected?'}
      >
        <div className="space-y-4 pb-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
            <p className="text-xs text-emerald-800 font-bold uppercase tracking-wider">
              {isTe ? 'నగదు వసూలు చేయవలసిన మొత్తం (COD)' : 'Cash on Delivery Amount'}
            </p>
            <p className="text-2xl font-black text-emerald-950">{formatPaise(order.total)}</p>
            <p className="text-xs text-emerald-700">
              {isTe
                ? `కస్టమర్ నుండి ${formatPaise(order.total)} తీసుకున్నారా?`
                : `Did you collect ${formatPaise(order.total)} from the customer?`}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleConfirmCod(false)}
              className="flex-1 min-h-[56px] text-sm font-bold"
            >
              {isTe ? 'లేదు (No)' : 'No'}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={actionLoading}
              onClick={() => handleConfirmCod(true)}
              className="flex-1 min-h-[56px] text-sm font-bold bg-emerald-700 hover:bg-emerald-800"
            >
              {actionLoading ? '...' : isTe ? 'అవును, వసూలైంది (Yes)' : 'Yes, Collected'}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Delivery Failed Sheet */}
      <BottomSheet
        isOpen={failSheetOpen}
        onClose={() => setFailSheetOpen(false)}
        title={isTe ? 'డెలివరీ విఫలమైంది' : 'Delivery Failed'}
      >
        <div className="space-y-4 pb-4">
          <div className="space-y-2 text-xs">
            <label className="font-bold text-ink-800">
              {isTe ? 'కారణం ఎంచుకోండి' : 'Select Reason'}
            </label>
            <select
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              className="w-full p-3 bg-white border border-ink-200 rounded-xl text-sm"
            >
              <option value="Customer unreachable">
                {isTe ? 'కస్టమర్ ఫోన్ ఎత్తలేదు (Unreachable)' : 'Customer unreachable'}
              </option>
              <option value="Address not found">
                {isTe ? 'చిరునామా దొరకలేదు (Address not found)' : 'Address not found'}
              </option>
              <option value="Customer refused order">
                {isTe ? 'కస్టమర్ ఆర్డర్ తీసుకోలేదు (Refused)' : 'Customer refused order'}
              </option>
              <option value="Incorrect address">
                {isTe ? 'తప్పుడు చిరునామా (Incorrect address)' : 'Incorrect address'}
              </option>
              <option value="Other">{isTe ? 'ఇతర కారణం (Other)' : 'Other'}</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFailSheetOpen(false)}
              className="flex-1 min-h-[56px] text-sm font-bold"
            >
              {isTe ? 'రద్దు' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={actionLoading}
              onClick={handleDeliveryFailed}
              className="flex-1 min-h-[56px] text-sm font-bold"
            >
              {actionLoading ? '...' : isTe ? 'నిర్ధారించు' : 'Confirm Failed'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
