import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastProvider } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineNotice } from './components/OfflineNotice';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { CartProvider } from './context/CartContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { CustomerLayout } from './layouts/CustomerLayout';
import { StoreLayout } from './layouts/StoreLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { Login } from './pages/public/Login';
import { CompleteProfile } from './pages/public/CompleteProfile';
import { StyleguidePage } from './pages/public/StyleguidePage';
import { CustomerPlaceholder } from './pages/customer/CustomerPlaceholder';
import { CustomerHome } from './pages/customer/CustomerHome';
import { LocationSetup } from './pages/customer/LocationSetup';
import { StoreDetail } from './pages/customer/StoreDetail';
import { Cart } from './pages/customer/Cart';
import { Checkout } from './pages/customer/Checkout';
import { OrderSuccess } from './pages/customer/OrderSuccess';
import { OrderDetail } from './pages/customer/OrderDetail';
import { Orders } from './pages/customer/Orders';
import { Profile } from './pages/customer/Profile';
import { StorePlaceholder } from './pages/store/StorePlaceholder';
import { StoreRegister } from './pages/store/StoreRegister';
import { StorePending } from './pages/store/StorePending';
import { StoreAddProducts } from './pages/store/StoreAddProducts';
import { StoreProducts } from './pages/store/StoreProducts';
import { StoreOrders } from './pages/store/StoreOrders';
import { StoreOrderDetail } from './pages/store/StoreOrderDetail';
import { StoreEarnings } from './pages/store/StoreEarnings';
import { StoreSettings } from './pages/store/StoreSettings';
import { StoreGuard } from './routes/StoreGuard';
import { SocketProvider } from './context/SocketContext';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminOrders } from './pages/admin/AdminOrders';
import { AdminComplaints } from './pages/admin/AdminComplaints';
import { AdminReports } from './pages/admin/AdminReports';
import { Catalogue } from './pages/admin/Catalogue';
import { Stores } from './pages/admin/Stores';
import { StoreShortLink } from './pages/public/StoreShortLink';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const HomeRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.phone && user.role !== 'admin') return <Navigate to="/complete-profile" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'store_owner') return <Navigate to="/store/orders" replace />;
  return <Navigate to="/app" replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <OfflineNotice />
      <GoogleOAuthProvider clientId={googleClientId}>
        <ToastProvider>
          <AuthProvider>
            <SocketProvider>
              <LocationProvider>
                <CartProvider>
                  <BrowserRouter>
                    <Routes>
                      {/* Public Routes */}
                      <Route path="/" element={<HomeRedirect />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/styleguide" element={<StyleguidePage />} />
                      <Route path="/s/:slug" element={<StoreShortLink />} />

                      {/* Protected Profile Completion */}
                      <Route
                        path="/complete-profile"
                        element={
                          <ProtectedRoute>
                            <CompleteProfile />
                          </ProtectedRoute>
                        }
                      />

                      {/* Customer Routes (Allows Customer & Store Owner) */}
                      <Route
                        path="/app"
                        element={
                          <ProtectedRoute allowedRoles={['customer']}>
                            <CustomerLayout />
                          </ProtectedRoute>
                        }
                      >
                        <Route index element={<CustomerHome />} />
                        <Route path="search" element={<CustomerHome />} />
                        <Route path="location" element={<LocationSetup />} />
                        <Route path="store/:id" element={<StoreDetail />} />
                        <Route path="cart" element={<Cart />} />
                        <Route path="checkout" element={<Checkout />} />
                        <Route path="order/:id/placed" element={<OrderSuccess />} />
                        <Route path="orders" element={<Orders />} />
                        <Route path="orders/:id" element={<OrderDetail />} />
                        <Route path="profile" element={<Profile />} />
                        <Route path="*" element={<CustomerPlaceholder />} />
                      </Route>

                      {/* Store Owner Routes (guarded by StoreGuard) */}
                      <Route
                        path="/store"
                        element={
                          <ProtectedRoute allowedRoles={['store_owner']}>
                            <StoreGuard>
                              <StoreLayout />
                            </StoreGuard>
                          </ProtectedRoute>
                        }
                      >
                        <Route path="register" element={<StoreRegister />} />
                        <Route path="pending" element={<StorePending />} />
                        <Route path="products/add" element={<StoreAddProducts />} />
                        <Route path="products" element={<StoreProducts />} />
                        <Route path="orders" element={<StoreOrders />} />
                        <Route path="orders/:id" element={<StoreOrderDetail />} />
                        <Route path="earnings" element={<StoreEarnings />} />
                        <Route path="settings" element={<StoreSettings />} />
                        <Route index element={<Navigate to="/store/orders" replace />} />
                        <Route path="*" element={<StorePlaceholder />} />
                      </Route>

                      {/* Admin Routes */}
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute allowedRoles={['admin']}>
                            <AdminLayout />
                          </ProtectedRoute>
                        }
                      >
                        <Route index element={<AdminDashboard />} />
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="stores" element={<Stores />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="catalogue" element={<Catalogue />} />
                        <Route path="orders" element={<AdminOrders />} />
                        <Route path="complaints" element={<AdminComplaints />} />
                        <Route path="reports" element={<AdminReports />} />
                        <Route path="*" element={<Navigate to="/admin" replace />} />
                      </Route>

                      {/* Catch-all */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </BrowserRouter>
                </CartProvider>
              </LocationProvider>
            </SocketProvider>
          </AuthProvider>
        </ToastProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}

export default App;
