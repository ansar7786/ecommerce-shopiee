import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  ChevronDown,
  Search,
  Plus,
  Store as StoreIcon,
  AlertCircle,
  RotateCcw,
  Check,
  Home,
  Briefcase,
  Compass,
} from 'lucide-react';
import api from '../../api/axios';
import { useLocationContext } from '../../context/LocationContext';
import { StoreCard, Skeleton, EmptyState, BottomSheet, Button } from '../../components/ui';

export const CustomerHome = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeAddress, addresses, coordinates, selectAddress } = useLocationContext();

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'open', 'delivery', 'pickup', 'freeDelivery'

  // Address bottom sheet state
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);

  // 1. Fetch nearby stores
  const fetchNearbyStores = useCallback(async () => {
    if (!coordinates?.lat || !coordinates?.lng) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/stores/nearby', {
        params: {
          lat: coordinates.lat,
          lng: coordinates.lng,
        },
      });
      setStores(res.data.stores || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load nearby stores. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [coordinates]);

  useEffect(() => {
    fetchNearbyStores();
  }, [fetchNearbyStores]);

  // Filter & Search stores
  const filteredStores = useMemo(() => {
    let list = [...stores];

    // Filter chip logic
    if (activeFilter === 'open') {
      list = list.filter((s) => s.isOpenNow);
    } else if (activeFilter === 'delivery') {
      list = list.filter((s) => s.deliverable);
    } else if (activeFilter === 'pickup') {
      list = list.filter((s) => s.supportsPickup);
    } else if (activeFilter === 'freeDelivery') {
      list = list.filter((s) => s.freeDeliveryAbove && s.freeDeliveryAbove > 0);
    }

    // Search query logic
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) || (s.address && s.address.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [stores, activeFilter, searchQuery]);

  const resolveAddressIcon = (label) => {
    if (label === 'Home') return Home;
    if (label === 'Work') return Briefcase;
    return Compass;
  };

  // 4. Gate: a customer with no address and no coordinates goes to C1 first
  if (!activeAddress && !coordinates && addresses.length === 0) {
    return <Navigate to="/app/location" replace />;
  }

  return (
    <div className="flex flex-col space-y-4 max-w-md mx-auto pb-12">
      {/* Deliver-to Top Bar */}
      <div
        onClick={() => setAddressSheetOpen(true)}
        className="flex items-center justify-between p-3 bg-white border border-ink-200/80 rounded-2xl shadow-xs cursor-pointer hover:border-primary-400 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-primary-100/70 text-primary-700 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 uppercase tracking-wider">
              <span>{t('customer.deliverTo')}</span>
              {activeAddress?.label && (
                <span className="font-bold text-primary-700 bg-primary-50 px-1.5 py-0.2 rounded">
                  {activeAddress.label}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold text-ink-900 truncate leading-snug">
              {activeAddress?.line || activeAddress?.landmark || 'Gudlavalleru, AP'}
            </p>
          </div>
        </div>

        <ChevronDown className="w-5 h-5 text-ink-400 shrink-0 ml-1" />
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={t('customer.searchStores')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-ink-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
        />
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: t('customer.all') },
          { id: 'open', label: t('customer.openNow') },
          { id: 'delivery', label: t('customer.delivery') },
          { id: 'pickup', label: t('customer.pickup') },
          { id: 'freeDelivery', label: t('customer.freeDelivery') },
        ].map((item) => {
          const isSelected = activeFilter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveFilter(item.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                isSelected
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-white border border-ink-300 text-ink-700 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Store List Section */}
      <div className="space-y-3 pt-1">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
            <p className="text-sm font-semibold text-red-800">{error}</p>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={fetchNearbyStores}
              className="gap-1.5 text-xs font-bold mx-auto"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t('common.retry')}</span>
            </Button>
          </div>
        ) : filteredStores.length === 0 ? (
          <EmptyState
            icon={StoreIcon}
            title={t('customer.noStores')}
            description={t('customer.noStoresDesc')}
            actionLabel={t('customer.changeLocation')}
            onAction={() => navigate('/app/location')}
          />
        ) : (
          filteredStores.map((store) => (
            <StoreCard
              key={store.id}
              store={store}
              onClick={() => {
                // Navigate to store catalog in Step 7
                navigate(`/app/store/${store.slug || store.id}`);
              }}
            />
          ))
        )}
      </div>

      {/* Address Selection Bottom Sheet */}
      <BottomSheet
        isOpen={addressSheetOpen}
        onClose={() => setAddressSheetOpen(false)}
        title={t('customer.selectAddress')}
      >
        <div className="space-y-3 pb-4">
          {addresses.map((addr) => {
            const Icon = resolveAddressIcon(addr.label);
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
                    : 'border-ink-200 hover:border-ink-300 bg-white shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-ink-900 leading-tight">
                        {addr.label}
                      </span>
                      {addr.isDefault && (
                        <span className="text-[10px] font-semibold text-primary-700 bg-primary-100 px-1.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-600 truncate mt-0.5">{addr.line}</p>
                    {addr.landmark && (
                      <p className="text-[11px] text-ink-500 truncate">
                        Near: {addr.landmark} • {addr.pincode}
                      </p>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Add New Address Button */}
          <div className="pt-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => {
                setAddressSheetOpen(false);
                navigate('/app/location');
              }}
              className="w-full min-h-[52px] font-bold text-sm gap-2 rounded-2xl"
            >
              <Plus className="w-4 h-4" />
              <span>{t('customer.addNewAddress')}</span>
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
