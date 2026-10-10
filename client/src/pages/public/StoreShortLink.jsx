import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Skeleton, EmptyState } from '../../components/ui';
import { Store, AlertCircle } from 'lucide-react';

export const StoreShortLink = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const resolveStore = async () => {
      try {
        const res = await api.get(`/stores/${slug}`);
        const store = res.data.store;
        if (store && isMounted) {
          navigate(`/app/store/${store._id || store.id}`, { replace: true });
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || 'Store not found');
        }
      }
    };

    if (slug) {
      resolveStore();
    }

    return () => {
      isMounted = false;
    };
  }, [slug, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <EmptyState
          icon={AlertCircle}
          title="Store Not Found"
          description="The store link you opened may have expired or is not yet approved."
          actionLabel="Explore Nearby Stores"
          onAction={() => navigate('/app', { replace: true })}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center p-6 space-y-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center animate-bounce">
        <Store className="w-7 h-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-extrabold text-ink-900">Connecting to Store...</h2>
        <p className="text-xs text-ink-500">Redirecting to live catalogue</p>
      </div>
      <Skeleton className="h-2 w-48 rounded-full" />
    </div>
  );
};
