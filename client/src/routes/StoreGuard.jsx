import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export const StoreGuard = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const checkStore = async () => {
      try {
        const res = await api.get('/stores/me');
        if (isMounted) {
          setStore(res.data.store || null);
        }
      } catch {
        if (isMounted) {
          setStore(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (user && user.role === 'store_owner') {
      checkStore();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user, location.pathname]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-ink-600">Verifying store access...</span>
      </div>
    );
  }

  const path = location.pathname;

  // Case 1: No store registered yet
  if (!store) {
    if (path === '/store/register') {
      return children || <Outlet />;
    }
    return <Navigate to="/store/register" replace />;
  }

  // Case 2: Store is pending review
  if (store.status === 'pending') {
    if (path === '/store/pending') {
      return children || <Outlet />;
    }
    return <Navigate to="/store/pending" replace />;
  }

  // Case 3: Store was rejected
  if (store.status === 'rejected') {
    if (path === '/store/pending' || path === '/store/register') {
      return children || <Outlet />;
    }
    return <Navigate to="/store/pending" replace />;
  }

  // Case 4: Store is suspended
  if (store.status === 'suspended') {
    if (path === '/store/pending') {
      return children || <Outlet />;
    }
    return <Navigate to="/store/pending" replace />;
  }

  // Case 5: Store is approved
  if (store.status === 'approved') {
    const isEditMode = location.search.includes('edit=true');
    // If approved, don't stay on register or pending screens unless editing
    if (
      (path === '/store/register' && !isEditMode) ||
      path === '/store/pending' ||
      path === '/store'
    ) {
      if ((store.productCount ?? 0) < 10) {
        return <Navigate to="/store/products/add" replace />;
      }
      return <Navigate to="/store/orders" replace />;
    }

    // Redirect an approved store with fewer than 10 products to S3 from /store/orders
    if (path === '/store/orders' && (store.productCount ?? 0) < 10) {
      return <Navigate to="/store/products/add" replace />;
    }

    return children || <Outlet />;
  }

  return children || <Outlet />;
};

StoreGuard.propTypes = {
  children: PropTypes.node,
};
