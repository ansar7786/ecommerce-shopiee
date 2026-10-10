import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Eye, AlertTriangle, XCircle, RefreshCw, Store, User } from 'lucide-react';
import api from '../../api/axios';
import {
  useToast,
  Card,
  Button,
  Badge,
  Skeleton,
  EmptyState,
  BottomSheet,
} from '../../components/ui';
import { formatPaise } from '../../utils/format';

const TERMINAL_STATUSES = ['DELIVERED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'DELIVERY_FAILED'];

export const AdminOrders = () => {
  const { i18n } = useTranslation();
  const { showToast } = useToast();
  const isTe = i18n.language === 'te';

  const [orders, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');

  // Order Detail Drawer state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Force Cancel Dialog state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Fetch store options for filter
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await api.get('/admin/stores');
        setStores(res.data.stores || []);
      } catch {
        // Ignored
      }
    };
    fetchStores();
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (storeFilter) params.store = storeFilter;

      const res = await api.get('/admin/orders', { params });
      setUsers(res.data.orders || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch platform orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, storeFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOpenDetail = async (orderId) => {
    try {
      setLoadingDetail(true);
      setDetailDrawerOpen(true);
      const res = await api.get(`/admin/orders/${orderId}`);
      setSelectedOrder(res.data.order);
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to fetch order details',
      });
      setDetailDrawerOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleForceCancel = async () => {
    if (!cancelNote.trim()) {
      showToast({
        type: 'error',
        message: isTe ? 'రద్దు చేయడానికి కారణం నమోదు చేయడం తప్పనిసరి' : 'Reason note is required',
      });
      return;
    }

    try {
      setCancelling(true);
      await api.patch(`/admin/orders/${selectedOrder._id}/force-cancel`, {
        note: cancelNote.trim(),
      });

      showToast({
        type: 'success',
        message: isTe ? 'ఆర్డర్ విజయవంతంగా రద్దు చేయబడింది' : 'Order force-cancelled successfully',
      });

      setCancelModalOpen(false);
      setCancelNote('');
      setDetailDrawerOpen(false);
      fetchOrders();
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to force-cancel order',
      });
    } finally {
      setCancelling(false);
    }
  };

  const resolveBadgeVariant = (status) => {
    switch (status) {
      case 'PLACED':
        return 'primary';
      case 'ACCEPTED':
      case 'PACKING':
      case 'READY':
        return 'accent';
      case 'OUT_FOR_DELIVERY':
        return 'primary';
      case 'DELIVERED':
        return 'success';
      case 'REJECTED':
      case 'CANCELLED':
      case 'EXPIRED':
      case 'DELIVERY_FAILED':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const isTerminal = (status) => TERMINAL_STATUSES.includes(status);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 antialiased">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-900 tracking-tight">
            {isTe ? 'అన్ని ఆర్డర్లు' : 'Platform Orders'}
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">
            {isTe
              ? 'కిరాణా నెట్‌వర్క్‌లోని అన్ని దుకాణాల ఆర్డర్లను పర్యవేక్షించండి మరియు నిర్వహించండి'
              : 'Monitor real-time status, audit timelines, and manage customer orders'}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={fetchOrders}
          className="text-xs font-bold self-start sm:self-auto flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isTe ? 'రిఫ్రెష్' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-ink-200 shadow-xs flex flex-wrap items-center gap-3">
        {/* Status Dropdown */}
        <div className="flex-1 min-w-[140px]">
          <label
            htmlFor="filter-status-select"
            className="text-[10px] font-extrabold uppercase text-ink-400 block mb-1"
          >
            Status
          </label>
          <select
            id="filter-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-900 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PLACED">Placed</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="PACKING">Packing</option>
            <option value="READY">Ready</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>

        {/* Store Dropdown */}
        <div className="flex-1 min-w-[160px]">
          <label
            htmlFor="filter-store-select"
            className="text-[10px] font-extrabold uppercase text-ink-400 block mb-1"
          >
            Store
          </label>
          <select
            id="filter-store-select"
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-900 outline-none"
          >
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {(statusFilter || storeFilter) && (
          <div className="self-end pb-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('');
                setStoreFilter('');
              }}
              className="text-xs font-bold text-ink-500 hover:text-ink-900"
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="pt-8 max-w-md mx-auto">
          <EmptyState
            icon={AlertTriangle}
            title={isTe ? 'లోడ్ చేయడం విఫలమైంది' : 'Error Loading Orders'}
            description={error}
            actionLabel={isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry'}
            onAction={fetchOrders}
          />
        </div>
      ) : orders.length === 0 ? (
        <div className="pt-8">
          <EmptyState
            icon={ClipboardList}
            title={isTe ? 'ఆర్డర్లు ఏవీ లేవు' : 'No Orders Found'}
            description={
              statusFilter || storeFilter
                ? isTe
                  ? 'ఎంచుకున్న ఫిల్టర్లకు సరిపోలే ఆర్డర్లు లేవు.'
                  : 'No orders match the selected filters.'
                : isTe
                  ? 'ఇంకా ప్లాట్‌ఫారమ్‌లో ఆర్డర్లు నమోదు కాలేదు.'
                  : 'No orders have been placed on the platform yet.'
            }
          />
        </div>
      ) : (
        <Card className="overflow-hidden border border-ink-200 rounded-2xl bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50/70 text-ink-500 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Order No</th>
                  <th className="py-3 px-4">Store</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {orders.map((o) => (
                  <tr key={o._id} className="hover:bg-ink-50/50 transition-colors">
                    {/* Order No & Date */}
                    <td className="py-3 px-4">
                      <span className="font-extrabold text-ink-900 block font-mono">
                        #{o.orderNo}
                      </span>
                      <span className="text-[10px] text-ink-400 block">
                        {new Date(o.createdAt).toLocaleDateString()}{' '}
                        {new Date(o.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>

                    {/* Store */}
                    <td className="py-3 px-4 font-bold text-ink-800 truncate max-w-[150px]">
                      {o.store?.name || '—'}
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-ink-900 block truncate max-w-[130px]">
                        {o.customer?.name || 'Customer'}
                      </span>
                      <span className="text-[10px] text-ink-500 font-mono block">
                        {o.customer?.phone || '—'}
                      </span>
                    </td>

                    {/* Items */}
                    <td className="py-3 px-4 text-ink-700 font-medium">
                      {o.items?.length || 0} {isTe ? 'వస్తువులు' : 'items'}
                    </td>

                    {/* Total */}
                    <td className="py-3 px-4 font-extrabold text-ink-900">
                      {formatPaise(o.total)}
                    </td>

                    {/* Payment */}
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-bold text-ink-800 block">
                        {o.paymentMethod}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          o.paymentStatus === 'SUCCESS'
                            ? 'text-emerald-700'
                            : o.paymentStatus === 'REFUNDED'
                              ? 'text-amber-700'
                              : 'text-ink-500'
                        }`}
                      >
                        {o.paymentStatus}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <Badge variant={resolveBadgeVariant(o.status)}>{o.status}</Badge>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenDetail(o._id)}
                        className="text-xs font-bold min-h-[32px] flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isTe ? 'వివరాలు' : 'View'}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Order Detail Modal / BottomSheet */}
      <BottomSheet
        isOpen={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        title={
          selectedOrder
            ? `${isTe ? 'ఆర్డర్' : 'Order'} #${selectedOrder.orderNo}`
            : isTe
              ? 'ఆర్డర్ వివరాలు'
              : 'Order Details'
        }
      >
        {loadingDetail || !selectedOrder ? (
          <div className="py-8 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-4 pb-4 text-xs">
            {/* Header Status & Force Cancel Button */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-ink-50 border border-ink-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
                  Current Status
                </span>
                <div className="mt-1">
                  <Badge variant={resolveBadgeVariant(selectedOrder.status)}>
                    {selectedOrder.status}
                  </Badge>
                </div>
              </div>

              {!isTerminal(selectedOrder.status) && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setCancelModalOpen(true)}
                  className="font-bold text-xs flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{isTe ? 'ఫోర్స్ రద్దు' : 'Force Cancel'}</span>
                </Button>
              )}
            </div>

            {/* Store & Customer Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-ink-200 bg-white space-y-1">
                <span className="text-[10px] font-bold uppercase text-ink-400 flex items-center gap-1">
                  <Store className="w-3 h-3 text-primary-600" /> Store
                </span>
                <p className="font-extrabold text-ink-900">{selectedOrder.store?.name}</p>
                <p className="text-ink-600 font-mono text-[11px]">{selectedOrder.store?.phone}</p>
                <p className="text-ink-500 text-[11px] truncate">{selectedOrder.store?.address}</p>
              </div>

              <div className="p-3 rounded-xl border border-ink-200 bg-white space-y-1">
                <span className="text-[10px] font-bold uppercase text-ink-400 flex items-center gap-1">
                  <User className="w-3 h-3 text-primary-600" /> Customer
                </span>
                <p className="font-extrabold text-ink-900">{selectedOrder.customer?.name}</p>
                <p className="text-ink-600 font-mono text-[11px]">
                  {selectedOrder.customer?.phone}
                </p>
                <p className="text-ink-500 text-[11px] truncate">{selectedOrder.customer?.email}</p>
              </div>
            </div>

            {/* Items List */}
            <div className="p-3.5 rounded-2xl border border-ink-200 bg-white space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
                Ordered Items ({selectedOrder.items?.length})
              </span>
              <div className="divide-y divide-ink-100">
                {selectedOrder.items?.map((it, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-ink-900">
                        {isTe && it.nameTe ? it.nameTe : it.name}
                      </p>
                      <p className="text-ink-500 text-[11px]">
                        {formatPaise(it.price)} × {it.qty}
                      </p>
                    </div>
                    <span className="font-extrabold text-ink-900">
                      {formatPaise(it.price * it.qty)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bill & Payment */}
            <div className="p-3.5 rounded-2xl border border-ink-200 bg-white space-y-1.5 font-medium">
              <div className="flex justify-between text-ink-600">
                <span>Subtotal</span>
                <span>{formatPaise(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-600">
                <span>Delivery Fee</span>
                <span>
                  {selectedOrder.deliveryFee === 0
                    ? 'FREE'
                    : formatPaise(selectedOrder.deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between font-black text-ink-900 pt-1.5 border-t border-ink-100 text-sm">
                <span>Total Amount</span>
                <span className="text-primary-700">{formatPaise(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Timeline / Status History */}
            <div className="p-3.5 rounded-2xl border border-ink-200 bg-white space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
                Audit Timeline ({selectedOrder.statusHistory?.length} events)
              </span>
              <div className="space-y-3 pt-1">
                {selectedOrder.statusHistory?.map((hist, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[11px]">
                    <div className="w-2 h-2 rounded-full bg-primary-600 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-ink-900">{hist.status}</span>
                        <span className="text-[10px] text-ink-400 font-mono">
                          {new Date(hist.at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-ink-600 text-[10px]">
                        By: <span className="font-semibold">{hist.byRole}</span>
                        {hist.note ? ` — "${hist.note}"` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Force Cancel Dialog */}
      <BottomSheet
        isOpen={cancelModalOpen}
        onClose={() => {
          if (!cancelling) setCancelModalOpen(false);
        }}
        title={isTe ? 'ఆర్డర్ ఫోర్స్ రద్దు చేయాలా?' : 'Force Cancel Order?'}
      >
        <div className="space-y-4 pb-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold">
                {isTe ? 'అడ్మిన్ ద్వారా బలవంతపు రద్దు' : 'Administrative Override'}
              </p>
              <p className="text-[11px] mt-0.5">
                {isTe
                  ? 'ఈ చర్య ద్వారా ఆర్డర్ వెంటనే రద్దు చేయబడుతుంది మరియు ప్రీపెయిడ్ ఆర్డర్ అయితే రీఫండ్ ప్రారంభించబడుతుంది.'
                  : 'This will unconditionally transition the order to CANCELLED and initiate mock refund if prepaid.'}
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="cancel-reason-textarea"
              className="text-xs font-bold text-ink-800 block mb-1"
            >
              {isTe ? 'రద్దు చేయడానికి కారణం (తప్పనిసరి)' : 'Reason Note (Required)'}
            </label>
            <textarea
              id="cancel-reason-textarea"
              rows={3}
              placeholder={
                isTe
                  ? 'ఉదా: కస్టమర్ అభ్యర్థన, దుకాణం స్పందించలేదు...'
                  : 'e.g. Customer call escalation, shop unreachable...'
              }
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              className="w-full bg-ink-50 border border-ink-200 focus:border-red-500 focus:bg-white rounded-xl p-3 text-xs outline-none transition-all placeholder:text-ink-400"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={cancelling}
              onClick={() => setCancelModalOpen(false)}
              className="flex-1 font-bold text-xs"
            >
              {isTe ? 'వెనుకకు' : 'Go Back'}
            </Button>

            <Button
              type="button"
              variant="danger"
              size="lg"
              disabled={!cancelNote.trim() || cancelling}
              onClick={handleForceCancel}
              className="flex-1 font-extrabold text-xs"
            >
              <span>
                {cancelling
                  ? isTe
                    ? 'రద్దు చేస్తోంది...'
                    : 'Cancelling...'
                  : isTe
                    ? 'రద్దు చేయి'
                    : 'Confirm Cancel'}
              </span>
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
