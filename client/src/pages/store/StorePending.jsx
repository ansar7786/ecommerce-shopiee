import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, AlertCircle, Edit, RotateCw, Store, MapPin, Phone } from 'lucide-react';
import api from '../../api/axios';
import { Button, Card, Badge, useToast } from '../../components/ui';
import { paiseToRupees } from '../../utils/format';

export const StorePending = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStoreStatus = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await api.get('/stores/me');
      const s = res.data.store;
      if (!s) {
        navigate('/store/register', { replace: true });
        return;
      }
      if (s.status === 'approved') {
        addToast('Congratulations! Your store is approved.', 'success');
        navigate('/store/orders', { replace: true });
        return;
      }
      setStore(s);
    } catch {
      addToast('Failed to check status', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate, addToast]);

  useEffect(() => {
    fetchStoreStatus();
  }, [fetchStoreStatus]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-ink-600">{t('common.loading')}</span>
      </div>
    );
  }

  if (!store) return null;

  const isRejected = store.status === 'rejected';

  return (
    <div className="flex flex-col max-w-md mx-auto py-4 space-y-6">
      {/* Top Status Card */}
      <Card className="text-center p-6 space-y-4">
        {isRejected ? (
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner animate-pulse">
            <Clock className="w-8 h-8" />
          </div>
        )}

        <div>
          <Badge variant={isRejected ? 'rejected' : 'placed'} className="mb-2">
            {isRejected ? 'Application Rejected' : 'Under Review'}
          </Badge>
          <h1 className="text-xl font-bold text-ink-900">
            {isRejected ? t('store.rejectedTitle') : t('store.pendingTitle')}
          </h1>
          <p className="text-xs text-ink-600 mt-2 max-w-sm mx-auto">
            {isRejected ? t('store.rejectedDesc') : t('store.pendingDesc')}
          </p>
        </div>

        {/* Rejection reason box */}
        {isRejected && store.rejectionReason && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-left space-y-1">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider">
              Admin Feedback:
            </span>
            <p className="text-sm text-red-900 font-medium">{store.rejectionReason}</p>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex flex-col gap-2.5">
          {isRejected ? (
            <Button
              variant="primary"
              size="lg"
              className="w-full min-h-[56px] text-base font-bold shadow-md gap-2"
              onClick={() => navigate('/store/register?edit=true')}
            >
              <Edit className="w-5 h-5" />
              {t('store.editResubmit')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              loading={refreshing}
              className="w-full min-h-[56px] gap-2"
              onClick={fetchStoreStatus}
            >
              <RotateCw className="w-5 h-5" />
              {t('store.refreshStatus')}
            </Button>
          )}
        </div>
      </Card>

      {/* Submitted Details Summary Card */}
      <Card className="space-y-4">
        <div className="border-b border-ink-100 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-primary-600" />
            Submitted Store Details
          </h2>
          <span className="text-xs text-ink-500">
            {new Date(store.createdAt).toLocaleDateString()}
          </span>
        </div>

        {store.photo && (
          <div className="w-full h-36 rounded-lg overflow-hidden bg-black/5">
            <img src={store.photo} alt={store.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="space-y-3 text-xs text-ink-700">
          <div className="flex items-start gap-2">
            <Store className="w-4 h-4 text-ink-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-ink-900">{store.name}</span>
              <p className="text-[11px] text-ink-500">Slug: {store.slug}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Phone className="w-4 h-4 text-ink-400 shrink-0 mt-0.5" />
            <span>{store.phone}</span>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-ink-400 shrink-0 mt-0.5" />
            <span>
              {store.address}, PIN: {store.pincode}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-ink-400 shrink-0 mt-0.5" />
            <span>
              Hours: {store.timings?.open || '07:00'} - {store.timings?.close || '21:00'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-ink-100 text-[11px]">
            <div>
              <span className="text-ink-500">Delivery Radius:</span>
              <p className="font-semibold text-ink-900">{store.deliveryRadiusKm} km</p>
            </div>
            <div>
              <span className="text-ink-500">Delivery Fee:</span>
              <p className="font-semibold text-ink-900">₹{paiseToRupees(store.deliveryFee)}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
