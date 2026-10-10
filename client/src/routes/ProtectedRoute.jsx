import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/ui/Skeleton';

export const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-3/4 rounded-xl" />
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Profile completion check for non-admin users
  if (!user.phone && user.role !== 'admin' && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const effectiveRoles = new Set(allowedRoles);
    // Customer routes also allow store_owner
    if (effectiveRoles.has('customer')) {
      effectiveRoles.add('store_owner');
    }

    if (!effectiveRoles.has(user.role)) {
      if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
      if (user.role === 'store_owner') return <Navigate to="/store/orders" replace />;
      return <Navigate to="/app" replace />;
    }
  }

  return children ? children : <Outlet />;
};
