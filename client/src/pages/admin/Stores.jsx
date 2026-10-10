import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Store,
  MapPin,
  Clock,
  Phone,
  ShieldCheck,
  Check,
  X,
  AlertTriangle,
  FileText,
  Search,
} from 'lucide-react';
import api from '../../api/axios';
import { DataTable, Button, Badge, BottomSheet, useToast } from '../../components/ui';
import { LocationPickerMap } from '../../components/map/LocationPickerMap';
import { formatPaise } from '../../utils/format';

export const Stores = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('pending');
  const [stores, setStores] = useState([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, suspended: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected store for detail drawer
  const [selectedStore, setSelectedStore] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        status: activeTab === 'all' ? undefined : activeTab,
        q: searchQuery.trim() || undefined,
      };
      const res = await api.get('/admin/stores', { params });
      setStores(res.data.stores || []);
      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const handleOpenStore = (store) => {
    setSelectedStore(store);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedStore(null);
    setRejectModalOpen(false);
    setRejectionReason('');
  };

  const handleUpdateStatus = async (storeId, action, reason = '') => {
    try {
      setActionLoading(true);
      const payload = { action };
      if (action === 'reject') {
        payload.rejectionReason = reason;
      }

      const res = await api.patch(`/admin/stores/${storeId}/status`, payload);
      addToast(res.data.message || 'Store status updated', 'success');

      // Update selected store in drawer and table
      if (res.data.store) {
        setSelectedStore(res.data.store);
      }
      setRejectModalOpen(false);
      setRejectionReason('');
      fetchStores();
    } catch (err) {
      addToast(err.response?.data?.message || 'Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const tabs = [
    {
      id: 'pending',
      label: t('adminStores.pending'),
      count: counts.pending,
      color: 'text-amber-700 bg-amber-50',
    },
    {
      id: 'approved',
      label: t('adminStores.approved'),
      count: counts.approved,
      color: 'text-emerald-700 bg-emerald-50',
    },
    {
      id: 'suspended',
      label: t('adminStores.suspended'),
      count: counts.suspended,
      color: 'text-purple-700 bg-purple-50',
    },
    { id: 'all', label: t('adminStores.all'), count: counts.all, color: 'text-ink-700 bg-ink-100' },
  ];

  const columns = [
    {
      header: t('adminStores.storeCol'),
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center border border-ink-200">
            {row.photo ? (
              <img src={row.photo} alt={row.name} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-5 h-5 text-ink-400" />
            )}
          </div>
          <div>
            <span className="font-semibold text-ink-900 block leading-tight">{row.name}</span>
            <span className="text-[11px] text-ink-500 font-mono">/{row.slug}</span>
          </div>
        </div>
      ),
    },
    {
      header: t('adminStores.ownerCol'),
      accessor: 'owner',
      render: (row) => (
        <div className="text-xs">
          <span className="font-medium text-ink-900 block">{row.owner?.name || 'Unknown'}</span>
          <span className="text-[11px] text-ink-500 block">{row.owner?.email || '-'}</span>
        </div>
      ),
    },
    {
      header: t('adminStores.contactCol'),
      accessor: 'phone',
      render: (row) => <span className="text-xs font-mono text-ink-700">{row.phone}</span>,
    },
    {
      header: t('adminStores.locationCol'),
      accessor: 'address',
      render: (row) => (
        <div className="text-xs max-w-[200px] truncate" title={`${row.address}, ${row.pincode}`}>
          <span className="text-ink-800">{row.address}</span>
          <span className="text-[11px] text-ink-500 block">PIN: {row.pincode}</span>
        </div>
      ),
    },
    {
      header: t('adminStores.radiusCol'),
      accessor: 'deliveryRadiusKm',
      render: (row) => (
        <span className="text-xs font-medium text-ink-700">{row.deliveryRadiusKm} km</span>
      ),
    },
    {
      header: t('adminStores.statusCol'),
      accessor: 'status',
      render: (row) => {
        const variants = {
          pending: 'placed',
          approved: 'accepted',
          suspended: 'rejected',
          rejected: 'rejected',
        };
        return (
          <Badge variant={variants[row.status] || 'placed'} className="capitalize">
            {row.status}
          </Badge>
        );
      },
    },
    {
      header: t('adminStores.actionsCol'),
      className: 'text-right',
      render: (row) => (
        <Button
          size="md"
          variant="secondary"
          className="text-xs font-semibold py-1.5 px-3"
          onClick={() => handleOpenStore(row)}
        >
          {t('adminStores.review')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">{t('adminStores.title')}</h1>
        <p className="text-sm text-ink-600 mt-1">{t('adminStores.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ink-200 gap-4 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-ink-500 hover:text-ink-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tab.color}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by shop name, phone, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-ink-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Stores DataTable */}
      <DataTable
        columns={columns}
        data={stores}
        loading={loading}
        error={error}
        onRetry={fetchStores}
        emptyMessage={t('adminStores.empty')}
      />

      {/* Detail Slide-over Drawer */}
      <BottomSheet
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        title={selectedStore?.name || t('adminStores.storeDetails')}
      >
        {selectedStore && (
          <div className="space-y-6 pb-4">
            {/* Store Photo Banner */}
            {selectedStore.photo ? (
              <div className="w-full h-44 rounded-xl overflow-hidden bg-black/5 border border-ink-200">
                <img
                  src={selectedStore.photo}
                  alt={selectedStore.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-24 rounded-xl bg-gray-100 flex items-center justify-center text-ink-400 border border-dashed border-ink-300 text-xs">
                No Store Photo Provided
              </div>
            )}

            {/* Status & Rejection Notice */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-ink-200">
              <span className="text-xs font-semibold text-ink-600">Current Status:</span>
              <Badge
                variant={
                  selectedStore.status === 'approved'
                    ? 'accepted'
                    : selectedStore.status === 'pending'
                      ? 'placed'
                      : 'rejected'
                }
                className="capitalize"
              >
                {selectedStore.status}
              </Badge>
            </div>

            {selectedStore.status === 'rejected' && selectedStore.rejectionReason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-red-800">Rejection Reason:</span>
                <p className="text-red-900">{selectedStore.rejectionReason}</p>
              </div>
            )}

            {/* Interactive Leaflet Map with Delivery Circle */}
            <div>
              <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary-600" />
                Store Location & Delivery Radius
              </h3>
              <LocationPickerMap
                latitude={selectedStore.location?.coordinates?.[1]}
                longitude={selectedStore.location?.coordinates?.[0]}
                radiusKm={selectedStore.deliveryRadiusKm}
                height="200px"
                readOnly={true}
              />
              <p className="text-[11px] text-ink-500 mt-1.5">
                {selectedStore.address}, PIN: {selectedStore.pincode}
              </p>
            </div>

            {/* Operational Settings */}
            <div className="space-y-2 border-t border-ink-100 pt-3">
              <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary-600" />
                {t('adminStores.timings')} & {t('adminStores.deliverySettings')}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-ink-500 text-[11px] block">Operating Hours</span>
                  <span className="font-semibold text-ink-900">
                    {selectedStore.timings?.open || '07:00'} -{' '}
                    {selectedStore.timings?.close || '21:00'}
                  </span>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-ink-500 text-[11px] block">Delivery Radius</span>
                  <span className="font-semibold text-ink-900">
                    {selectedStore.deliveryRadiusKm} km
                  </span>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-ink-500 text-[11px] block">Delivery Fee</span>
                  <span className="font-semibold text-ink-900">
                    {formatPaise(selectedStore.deliveryFee)}
                  </span>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-ink-500 text-[11px] block">Free Delivery Above</span>
                  <span className="font-semibold text-ink-900">
                    {formatPaise(selectedStore.freeDeliveryAbove)}
                  </span>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-ink-500 text-[11px] block">Min Order Amount</span>
                  <span className="font-semibold text-ink-900">
                    {formatPaise(selectedStore.minOrder)}
                  </span>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-ink-500 text-[11px] block">Fulfillment Modes</span>
                  <span className="font-semibold text-ink-900">
                    {[
                      selectedStore.supportsDelivery && 'Delivery',
                      selectedStore.supportsPickup && 'Pickup',
                    ]
                      .filter(Boolean)
                      .join(' + ') || 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Legal Documents */}
            <div className="border-t border-ink-100 pt-3">
              <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary-600" />
                {t('adminStores.documents')}
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-ink-600">GSTIN:</span>
                  <span className="font-mono font-semibold text-ink-900">
                    {selectedStore.gstNumber || 'Not provided'}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-ink-600">FSSAI License:</span>
                  <span className="font-mono font-semibold text-ink-900">
                    {selectedStore.fssaiNumber || 'Not provided'}
                  </span>
                </div>
              </div>
            </div>

            {/* Owner Details */}
            <div className="border-t border-ink-100 pt-3">
              <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-primary-600" />
                {t('adminStores.ownerInfo')}
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-600">Name:</span>
                  <span className="font-semibold text-ink-900">
                    {selectedStore.owner?.name || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-600">Email:</span>
                  <span className="text-ink-900">{selectedStore.owner?.email || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-600">Phone:</span>
                  <span className="font-mono font-semibold text-ink-900">
                    {selectedStore.phone}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-ink-200 pt-4 flex flex-col gap-2">
              {selectedStore.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="lg"
                    loading={actionLoading}
                    className="flex-1 font-bold shadow-md gap-1.5"
                    onClick={() => handleUpdateStatus(selectedStore._id, 'approve')}
                  >
                    <Check className="w-5 h-5" />
                    {t('adminStores.approve')}
                  </Button>
                  <Button
                    variant="danger"
                    size="lg"
                    loading={actionLoading}
                    className="flex-1 font-bold shadow-md gap-1.5"
                    onClick={() => setRejectModalOpen(true)}
                  >
                    <X className="w-5 h-5" />
                    {t('adminStores.reject')}
                  </Button>
                </div>
              )}

              {selectedStore.status === 'approved' && (
                <Button
                  variant="danger"
                  size="lg"
                  loading={actionLoading}
                  className="w-full font-bold shadow-md gap-1.5"
                  onClick={() => handleUpdateStatus(selectedStore._id, 'suspend')}
                >
                  <AlertTriangle className="w-5 h-5" />
                  {t('adminStores.suspend')}
                </Button>
              )}

              {selectedStore.status === 'suspended' && (
                <Button
                  variant="primary"
                  size="lg"
                  loading={actionLoading}
                  className="w-full font-bold shadow-md gap-1.5"
                  onClick={() => handleUpdateStatus(selectedStore._id, 'reactivate')}
                >
                  <ShieldCheck className="w-5 h-5" />
                  {t('adminStores.reactivate')}
                </Button>
              )}

              {selectedStore.status === 'rejected' && (
                <Button
                  variant="primary"
                  size="lg"
                  loading={actionLoading}
                  className="w-full font-bold shadow-md gap-1.5"
                  onClick={() => handleUpdateStatus(selectedStore._id, 'approve')}
                >
                  <Check className="w-5 h-5" />
                  Reconsider & Approve
                </Button>
              )}
            </div>

            {/* Rejection Modal / Prompt */}
            {rejectModalOpen && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3 mt-3 animate-in fade-in">
                <label className="block text-xs font-bold text-red-900">
                  {t('adminStores.rejectionReasonPrompt')}
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={t('adminStores.rejectionReasonPlaceholder')}
                  className="w-full p-2.5 text-xs bg-white border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-ink-900"
                />
                <div className="flex justify-end gap-2">
                  <Button size="md" variant="secondary" onClick={() => setRejectModalOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="md"
                    variant="danger"
                    loading={actionLoading}
                    disabled={!rejectionReason.trim()}
                    onClick={() =>
                      handleUpdateStatus(selectedStore._id, 'reject', rejectionReason.trim())
                    }
                  >
                    {t('adminStores.confirmReject')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
