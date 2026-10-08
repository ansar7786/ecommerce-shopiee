import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import { CustomerLayout } from './layouts/CustomerLayout';
import { StoreLayout } from './layouts/StoreLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { StyleguidePage } from './pages/public/StyleguidePage';
import { CustomerPlaceholder } from './pages/customer/CustomerPlaceholder';
import { StorePlaceholder } from './pages/store/StorePlaceholder';
import { AdminPlaceholder } from './pages/admin/AdminPlaceholder';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/styleguide" replace />} />
          <Route path="/styleguide" element={<StyleguidePage />} />

          {/* Customer Layout Routes */}
          <Route path="/app" element={<CustomerLayout />}>
            <Route index element={<CustomerPlaceholder />} />
            <Route path="*" element={<CustomerPlaceholder />} />
          </Route>

          {/* Store Layout Routes */}
          <Route path="/store" element={<StoreLayout />}>
            <Route index element={<StorePlaceholder />} />
            <Route path="*" element={<StorePlaceholder />} />
          </Route>

          {/* Admin Layout Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminPlaceholder />} />
            <Route path="*" element={<AdminPlaceholder />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/styleguide" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
