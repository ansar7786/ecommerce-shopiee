import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
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
} from 'lucide-react';
import { LanguageToggle } from '../components/LanguageToggle';

export const AdminLayout = () => {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <LanguageToggle />
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
              <span className="font-bold text-ink-900 text-sm block">Kirana Admin</span>
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
              </NavLink>
            );
          })}
        </nav>

        {/* Desktop Sidebar Footer */}
        <div className="p-4 border-t border-ink-300/40 hidden md:flex items-center justify-between">
          <span className="text-xs text-ink-600">Language:</span>
          <LanguageToggle />
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
