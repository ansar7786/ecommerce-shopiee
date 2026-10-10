import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Store,
  Users,
  Layers,
  ClipboardList,
  AlertTriangle,
  BarChart3,
  Menu,
  X,
  Shield,
  LogOut,
} from 'lucide-react';
import api from '../api/axios';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { LanguageToggle } from '../components/LanguageToggle';

export const AdminLayout = () => {
  const { t } = useTranslation();
  const { socket } = useSocket();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await api.get('/admin/stores?status=pending');
      const count = res.data.counts?.pending ?? res.data.stores?.length ?? 0;
      setPendingCount(count);
    } catch {
      // Silently ignore background count fetch errors
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();

    // 15-second polling fallback
    const interval = setInterval(fetchPendingCount, 15000);

    // Socket real-time updates
    if (socket) {
      socket.on('store:registered', fetchPendingCount);
      socket.on('store:status', fetchPendingCount);
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('store:registered', fetchPendingCount);
        socket.off('store:status', fetchPendingCount);
      }
    };
  }, [socket, fetchPendingCount]);

  const navItems = [
    { to: '/admin', end: true, label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/admin/stores', label: t('nav.stores'), icon: Store },
    { to: '/admin/users', label: t('nav.users'), icon: Users },
    { to: '/admin/catalogue', label: t('nav.catalogue'), icon: Layers },
    { to: '/admin/orders', label: t('nav.orders'), icon: ClipboardList },
    { to: '/admin/complaints', label: t('nav.complaints'), icon: AlertTriangle },
    { to: '/admin/reports', label: t('nav.reports'), icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-page flex flex-col md:flex-row antialiased">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-ink-300/60 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -ml-2 text-ink-900 rounded-lg hover:bg-page"
            aria-label="Toggle admin navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-1.5 font-bold text-ink-900">
            <Shield className="w-5 h-5 text-primary-600" />
            <span>Admin Portal</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 text-ink-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title={t('auth.logout')}
            aria-label={t('auth.logout')}
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Desktop Left Sidebar & Mobile Drawer */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 md:z-30 h-screen w-64 bg-white border-r border-ink-300/60 flex flex-col transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 px-5 border-b border-ink-300/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-ink-900 text-white font-bold flex items-center justify-center shadow-sm">
              <Shield className="w-5 h-5 text-accent-500" />
            </div>
            <div>
              <span className="font-bold text-ink-900 text-sm block">Locart Admin</span>
              <span className="text-[11px] text-ink-600 block">Console</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-ink-600 hover:text-ink-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-600 font-bold'
                      : 'text-ink-600 hover:text-ink-900 hover:bg-page'
                  }`
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />
                <span className="truncate">{item.label}</span>
                {item.to === '/admin/stores' && pendingCount > 0 && (
                  <span className="ml-auto bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-ink-300/40 space-y-3 bg-page/40">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-ink-600">Language:</span>
            <LanguageToggle />
          </div>

          <div className="pt-2.5 border-t border-ink-200/60">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-7 h-7 rounded-lg bg-ink-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {(user?.name || user?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-ink-900 truncate">
                  {user?.name || user?.email || 'Administrator'}
                </p>
                <p className="text-[10px] text-ink-500 truncate uppercase tracking-wider font-semibold">
                  {user?.role || 'admin'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-red-200/80 rounded-xl transition-colors shadow-xs"
              title={t('auth.logout')}
            >
              <LogOut className="w-4 h-4" />
              <span>{t('auth.logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-ink-900/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area (Desktop-first) */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
