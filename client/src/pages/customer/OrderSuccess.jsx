import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  Clock,
  Store as StoreIcon,
  ShoppingBag,
  ArrowRight,
  Home,
  Truck,
  ShieldCheck,
} from 'lucide-react';
import api from '../../api/axios';
import { Button, Card, Skeleton } from '../../components/ui';
import { formatPaise } from '../../utils/format';

export const OrderSuccess = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order);

  useEffect(() => {
    if (!order) {
      api
        .get(`/orders/${id}`)
        .then((res) => {
          setOrder(res.data.order);
        })
        .catch(() => {
          // If cannot load, fallback
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id, order]);

  if (loading) {
    return (
      <div className="py-12 space-y-4 max-w-sm mx-auto text-center">
        <Skeleton className="w-20 h-20 rounded-full mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const isPickup = order?.fulfilment === 'pickup';
  const orderNumber = order?.orderNo || id;

  return (
    <div className="py-6 space-y-6 max-w-md mx-auto text-center pb-24">
      {/* Animated Success Checkmark */}
      <div className="flex flex-col items-center justify-center pt-2">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center animate-ping absolute inset-0 opacity-40" />
          <div className="w-20 h-20 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg relative z-10 transition-transform duration-500 scale-100 animate-in zoom-in-50">
            <Check className="w-10 h-10 stroke-[3]" />
          </div>
        </div>

        <h1 className="text-xl font-black text-ink-900 mt-5">Order Placed Successfully!</h1>
        <p className="text-xs text-ink-500 mt-1">
          Thank you for ordering with your neighbourhood kirana store.
        </p>

        <div className="mt-3 inline-flex items-center gap-1.5 bg-primary-50 text-primary-800 border border-primary-200 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide">
          <span>Order #{orderNumber}</span>
        </div>
      </div>

      {/* ETA & Store Card */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white text-left space-y-3 shadow-xs">
        {/* Estimated Time */}
        <div className="flex items-center gap-3 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
            {isPickup ? <Clock className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
          </div>
          <div>
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              {isPickup ? 'Estimated Pickup Time' : 'Estimated Delivery Time'}
            </span>
            <p className="text-sm font-extrabold text-emerald-950">
              {isPickup ? 'Ready in 15–20 minutes' : 'Arriving in 20–30 minutes'}
            </p>
          </div>
        </div>

        {/* Store & Amount Details */}
        <div className="space-y-2 pt-1 text-xs">
          <div className="flex items-center justify-between text-ink-700">
            <span className="flex items-center gap-1.5">
              <StoreIcon className="w-3.5 h-3.5 text-ink-400" />
              Store:
            </span>
            <span className="font-extrabold text-ink-900">
              {order?.store?.name || 'Local Store'}
            </span>
          </div>

          <div className="flex items-center justify-between text-ink-700">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-ink-400" />
              Items:
            </span>
            <span className="font-bold text-ink-900">
              {order?.items?.length || 1} {order?.items?.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="flex items-center justify-between text-ink-700">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-ink-400" />
              Payment:
            </span>
            <span className="font-bold text-ink-900">
              Cash on Delivery ({formatPaise(order?.total || 0)})
            </span>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-2.5 pt-2">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={() => navigate(`/app/orders/${order?._id || orderNumber}`)}
          className="w-full font-extrabold text-sm min-h-[50px] shadow-md flex items-center justify-center gap-2"
        >
          <span>Track Order</span>
          <ArrowRight className="w-4 h-4" />
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => navigate('/app')}
          className="w-full font-bold text-sm min-h-[48px] flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          <span>Back to Home</span>
        </Button>
      </div>
    </div>
  );
};
