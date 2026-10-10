import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BellOff, Volume2, VolumeX, Clock, Check, X, ChevronRight, Package } from 'lucide-react';
import api from '../../api/axios';
import { useSocket } from '../../context/SocketContext';
import {
  Button,
  Badge,
  Card,
  EmptyState,
  Skeleton,
  BottomSheet,
  useToast,
} from '../../components/ui';
import { LanguageToggle } from '../../components/LanguageToggle';
import { formatPaise } from '../../utils/format';

export const StoreOrders = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';
  const { socket, registerRefreshListener } = useSocket();
  const { showToast } = useToast();

  // State
  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({ new: 0, preparing: 0, readyOut: 0, done: 0 });
  const [activeTab, setActiveTab] = useState('new'); // 'new', 'preparing', 'readyOut', 'done'
  const [loading, setLoading] = useState(true);

  // Audio & Alerts
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef(null);
  const beepIntervalRef = useRef(null);

  // Wake Lock
  const wakeLockRef = useRef(null);

  // Popup Queue for New Orders
  const [newOrderQueue, setNewOrderQueue] = useState([]);
  const [currentModalOrder, setCurrentModalOrder] = useState(null);
  const [rejectSheetOpen, setRejectSheetOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Out of stock');
  const [modalTimeRemaining, setModalTimeRemaining] = useState(180);

  // 1. Fetch Store and Orders
  const fetchStoreData = useCallback(async () => {
    try {
      const res = await api.get('/stores/me');
      setStore(res.data.store);
    } catch {
      // Ignored
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/store/orders', {
        params: { status: activeTab },
      });
      setOrders(res.data.orders || []);
      if (res.data.tabCounts) {
        setCounts(res.data.tabCounts);
      }
    } catch (err) {
      console.error('[StoreOrders] Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchStoreData();
    fetchOrders();
  }, [fetchStoreData, fetchOrders]);

  // Register socket reconnect / visibility listener
  useEffect(() => {
    const unregister = registerRefreshListener(() => {
      fetchOrders();
      fetchStoreData();
    });
    return unregister;
  }, [registerRefreshListener, fetchOrders, fetchStoreData]);

  // 2. Web Audio Beeper
  const playBeep = useCallback(() => {
    if (!audioUnlocked || !soundEnabled) return;
    try {
      const ctx =
        audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch (err) {
      console.error('[Audio] Beep error:', err);
    }
  }, [audioUnlocked, soundEnabled]);

  const startRepeatingBeep = useCallback(() => {
    if (beepIntervalRef.current) return;
    playBeep();
    beepIntervalRef.current = setInterval(playBeep, 1600);
  }, [playBeep]);

  const stopRepeatingBeep = useCallback(() => {
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
  }, []);

  const unlockAudio = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      ctx.resume().then(() => {
        setAudioUnlocked(true);
        // Play a soft confirmation chime
        playBeep();
      });
    } catch {
      setAudioUnlocked(true);
    }
  };

  // 3. Screen Wake Lock API
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {
          // Wake lock request failed or unsupported
        }
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  // 4. Socket Events listener
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = ({ order }) => {
      fetchOrders();
      // Add to popup queue
      setNewOrderQueue((prev) => [...prev, order]);
    };

    const handleStatusUpdate = () => {
      fetchOrders();
    };

    socket.on('order:new', handleNewOrder);
    socket.on('order:status', handleStatusUpdate);

    return () => {
      socket.off('order:new', handleNewOrder);
      socket.off('order:status', handleStatusUpdate);
    };
  }, [socket, fetchOrders]);

  // Manage current order modal from queue
  useEffect(() => {
    if (!currentModalOrder && newOrderQueue.length > 0) {
      const [nextOrder, ...rest] = newOrderQueue;
      setCurrentModalOrder(nextOrder);
      setNewOrderQueue(rest);
    }
  }, [currentModalOrder, newOrderQueue]);

  const handleDismissModal = useCallback(() => {
    stopRepeatingBeep();
    setCurrentModalOrder(null);
  }, [stopRepeatingBeep]);

  // Countdown timer for modal order
  useEffect(() => {
    if (!currentModalOrder) {
      stopRepeatingBeep();
      return;
    }

    startRepeatingBeep();

    const calculateRemaining = () => {
      const expiresAt = new Date(currentModalOrder.expiresAt).getTime();
      const remainingSeconds = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setModalTimeRemaining(remainingSeconds);
      if (remainingSeconds <= 0) {
        // Expired on screen
        handleDismissModal();
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);

    return () => {
      clearInterval(interval);
      stopRepeatingBeep();
    };
  }, [currentModalOrder, startRepeatingBeep, stopRepeatingBeep, handleDismissModal]);

  // Accept Order
  const handleAcceptOrder = async (orderId) => {
    try {
      await api.patch(`/store/orders/${orderId}/accept`);
      showToast({ type: 'success', message: 'ఆర్డర్ ఆమోదించబడింది! (Order accepted)' });
      handleDismissModal();
      fetchOrders();
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to accept order.',
      });
      handleDismissModal();
    }
  };

  // Reject Order
  const handleRejectOrder = async (orderId) => {
    try {
      await api.patch(`/store/orders/${orderId}/reject`, {
        reason: rejectReason,
      });
      showToast({ type: 'info', message: isTe ? 'ఆర్డర్ తిరస్కరించబడింది' : 'Order declined' });
      setRejectSheetOpen(false);
      handleDismissModal();
      fetchOrders();
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to reject order.',
      });
    }
  };

  // Toggle Store Open
  const handleToggleStoreOpen = async () => {
    if (!store) return;
    try {
      const res = await api.patch('/stores/me/open', {
        isOpen: !store.isOpen,
      });
      setStore(res.data.store);
      showToast({
        type: 'success',
        message: !store.isOpen
          ? isTe
            ? 'దుకాణం తెరవబడింది'
            : 'Store Opened'
          : isTe
            ? 'దుకాణం మూసివేయబడింది'
            : 'Store Closed',
      });
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Could not toggle store status',
      });
    }
  };

  const tabs = [
    { key: 'new', label: isTe ? 'కొత్తవి' : 'New', count: counts.new },
    { key: 'preparing', label: isTe ? 'ప్యాకింగ్' : 'Preparing', count: counts.preparing },
    { key: 'readyOut', label: isTe ? 'సిద్ధంగా' : 'Ready', count: counts.readyOut },
    { key: 'done', label: isTe ? 'పూర్తయినవి' : 'Done', count: counts.done },
  ];

  return (
    <div className="space-y-4 pb-28">
      {/* Top Header Bar */}
      <div className="bg-white p-3 rounded-2xl border border-ink-200 shadow-xs flex items-center justify-between gap-2">
        {/* Big Open/Closed Toggle */}
        <button
          type="button"
          onClick={handleToggleStoreOpen}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-black text-xs min-h-[48px] transition-all shadow-xs active:scale-95 ${
            store?.isOpen
              ? 'bg-emerald-600 text-white shadow-emerald-200'
              : 'bg-red-600 text-white shadow-red-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          <span>
            {store?.isOpen
              ? isTe
                ? 'షాప్ తెరిచి ఉంది'
                : 'Store Open'
              : isTe
                ? 'షాప్ మూసి ఉంది'
                : 'Store Closed'}
          </span>
        </button>

        {/* Action Toggles: Sound & Language */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`p-2.5 rounded-xl border min-h-[48px] min-w-[48px] flex items-center justify-center transition-colors ${
              soundEnabled
                ? 'bg-primary-50 text-primary-700 border-primary-200'
                : 'bg-gray-100 text-gray-500 border-gray-300'
            }`}
            title={soundEnabled ? 'Sound alerts enabled' : 'Sound alerts muted'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <LanguageToggle />
        </div>
      </div>

      {/* Audio Unlock Warning Banner */}
      {!audioUnlocked && (
        <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <BellOff className="w-5 h-5 text-amber-700 shrink-0" />
            <div className="text-xs text-amber-950 font-bold leading-tight">
              <p>{isTe ? 'ధ్వని హెచ్చరికలు నిలిపివేయబడ్డాయి' : 'Sound alerts disabled'}</p>
              <p className="font-normal text-[11px] text-amber-800">
                {isTe
                  ? 'కొత్త ఆర్డర్ సౌండ్ వినడానికి ఆన్ చేయండి'
                  : 'Enable to hear incoming order alerts'}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={unlockAudio}
            className="text-xs font-black min-h-[40px] px-3 whitespace-nowrap"
          >
            {isTe ? 'ఆన్ చేయండి' : 'Enable alerts'}
          </Button>
        </div>
      )}

      {/* Tabs Row (56px touch target standard) */}
      <div className="grid grid-cols-4 gap-1.5 bg-white p-1.5 rounded-2xl border border-ink-200 shadow-xs">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl min-h-[56px] transition-all text-xs font-bold leading-tight ${
                isSelected ? 'bg-primary-600 text-white shadow-xs' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              <span className="truncate max-w-[80px]">{tab.label}</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full mt-0.5 ${
                  isSelected ? 'bg-white text-primary-700' : 'bg-ink-100 text-ink-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      <div className="space-y-3 pt-1">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : orders.length === 0 ? (
          <div className="pt-6">
            <EmptyState
              icon={Package}
              title={isTe ? 'ఆర్డర్లు లేవు' : 'No Orders'}
              description={
                isTe
                  ? `ఈ విభాగంలో ఆర్డర్లు ఏవీ లేవు (${activeTab}).`
                  : `No orders in this tab (${activeTab}).`
              }
            />
          </div>
        ) : (
          orders.map((order) => (
            <Card
              key={order._id}
              onClick={() => navigate(`/store/orders/${order._id}`)}
              className="p-4 border border-ink-200 rounded-2xl bg-white hover:border-primary-400 hover:shadow-md transition-all cursor-pointer space-y-2.5 active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-ink-900">#{order.orderNo}</span>
                  <Badge variant={order.status === 'PLACED' ? 'primary' : 'neutral'}>
                    {order.status}
                  </Badge>
                </div>
                <span className="text-base font-black text-primary-700">
                  {formatPaise(order.total)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-ink-600">
                <span className="font-extrabold text-ink-800">
                  {order.customer?.name || 'Customer'}
                </span>
                <span>
                  {order.items.length} {order.items.length === 1 ? 'item' : 'items'} •{' '}
                  {order.fulfilment === 'delivery'
                    ? isTe
                      ? 'డెలివరీ'
                      : 'Delivery'
                    : isTe
                      ? 'పికప్'
                      : 'Pickup'}
                </span>
              </div>

              <div className="pt-2 border-t border-ink-100 flex items-center justify-between text-[11px] text-ink-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-ink-400" />
                  {new Date(order.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="font-bold text-primary-600 flex items-center gap-0.5">
                  {isTe ? 'వివరాలు చూడండి' : 'View Details'}{' '}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* FULL-SCREEN NEW ORDER POPUP OVERLAY */}
      {currentModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 border-4 border-emerald-500">
            {/* Header with 3-minute Countdown Ring */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                <h2 className="text-lg font-black text-emerald-950">
                  {isTe ? 'కొత్త ఆర్డర్!' : 'New Order!'}
                </h2>
              </div>

              {/* Countdown badge */}
              <div className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {Math.floor(modalTimeRemaining / 60)}:
                  {String(modalTimeRemaining % 60).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Customer & Order Summary Card */}
            <div className="bg-gray-50 border border-ink-200 p-4 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-500 font-semibold">
                  {isTe ? 'కస్టమర్:' : 'Customer:'}
                </span>
                <span className="font-black text-sm text-ink-900">
                  {currentModalOrder.customer?.name?.split(' ')[0] || 'Customer'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-ink-500 font-semibold">{isTe ? 'మొత్తం:' : 'Total:'}</span>
                <span className="font-black text-base text-primary-700">
                  {formatPaise(currentModalOrder.total)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-ink-500 font-semibold">{isTe ? 'వస్తువులు:' : 'Items:'}</span>
                <span className="font-bold text-ink-800">
                  {currentModalOrder.items?.length} {isTe ? 'వస్తువులు' : 'items'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-ink-500 font-semibold">
                  {isTe ? 'చెల్లింపు:' : 'Payment:'}
                </span>
                <span className="font-bold text-ink-800">
                  {currentModalOrder.paymentMethod} ({currentModalOrder.paymentStatus})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-ink-500 font-semibold">{isTe ? 'రకం:' : 'Type:'}</span>
                <span className="font-bold text-ink-800">
                  {currentModalOrder.fulfilment === 'delivery'
                    ? isTe
                      ? 'హోమ్ డెలివరీ'
                      : 'Home Delivery'
                    : isTe
                      ? 'షాప్ పికప్'
                      : 'Store Pickup'}
                </span>
              </div>
            </div>

            {/* Large 56px Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectSheetOpen(true)}
                className="w-full min-h-[56px] rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-200 active:scale-95 transition-all"
              >
                <X className="w-5 h-5 stroke-[3]" />
                <span>{isTe ? 'తిరస్కరించు' : 'Reject'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleAcceptOrder(currentModalOrder._id)}
                className="w-full min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 transition-all"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>{isTe ? 'స్వీకరించు' : 'Accept'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reasons Bottom Sheet */}
      <BottomSheet
        isOpen={rejectSheetOpen}
        onClose={() => setRejectSheetOpen(false)}
        title={isTe ? 'తిరస్కరణ కారణం' : 'Select Reason'}
      >
        <div className="space-y-4 pb-4">
          <div className="space-y-2">
            {[
              { key: 'Out of stock', label: isTe ? 'వస్తువులు లేవు' : 'Items out of stock' },
              { key: 'Shop closing', label: isTe ? 'షాప్ మూసివేస్తున్నాము' : 'Store closing soon' },
              { key: 'Too far', label: isTe ? 'చాలా దూరం' : 'Too far' },
              { key: 'Other', label: isTe ? 'ఇతర కారణం' : 'Other' },
            ].map((r) => (
              <label
                key={r.key}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  rejectReason === r.key
                    ? 'border-red-600 bg-red-50 text-red-950 font-bold'
                    : 'border-ink-200 bg-white'
                }`}
              >
                <span className="text-xs">{r.label}</span>
                <input
                  type="radio"
                  name="rejectReason"
                  value={r.key}
                  checked={rejectReason === r.key}
                  onChange={() => setRejectReason(r.key)}
                  className="accent-red-600"
                />
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setRejectSheetOpen(false)}
              className="flex-1 font-bold text-xs min-h-[48px]"
            >
              {isTe ? 'రద్దు' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              onClick={() => handleRejectOrder(currentModalOrder._id)}
              className="flex-1 font-bold text-xs min-h-[48px]"
            >
              {isTe ? 'ధృవీకరించు' : 'Confirm Reject'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
