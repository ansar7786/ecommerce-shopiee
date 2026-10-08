import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Search, ShoppingCart, Package, User } from 'lucide-react';
import { LanguageToggle } from '../components/LanguageToggle';

export const CustomerLayout = () => {
  const { t } = useTranslation();

  const navItems = [
    { to: '/app', end: true, label: t('nav.home'), icon: Home },
    { to: '/app/search', label: t('nav.search'), icon: Search },
    { to: '/app/cart', label: t('nav.cart'), icon: ShoppingCart },
    { to: '/app/orders', label: t('nav.orders'), icon: Package },
    { to: '/app/profile', label: t('nav.profile'), icon: User },
  ];

  return (
    <div className="min-h-screen bg-page flex flex-col antialiased">
      {/* TopBar */}
      <header className="sticky top-0 z-40 bg-white border-b border-ink-300/50 shadow-xs">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <NavLink to="/app" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary-600 text-white font-bold flex items-center justify-center text-lg shadow-sm">
              K
            </span>
            <span className="font-bold text-lg text-ink-900 tracking-tight">{t('app.name')}</span>
          </NavLink>
          <LanguageToggle />
        </div>
      </header>

      {/* Main Content (Centred max-w-md on desktop) */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 pb-24">
        <Outlet />
      </main>

      {/* BottomNav (Centred max-w-md on desktop) */}
      <nav
        aria-label="Customer Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-ink-300/60 shadow-lg md:max-w-md md:mx-auto md:rounded-t-2xl"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 gap-1 text-xs transition-colors ${
                    isActive ? 'text-primary-600 font-bold' : 'text-ink-600 hover:text-ink-900'
                  }`
                }
              >
                <Icon className="w-5 h-5 stroke-[2.2]" />
                <span className="truncate max-w-[64px]">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
