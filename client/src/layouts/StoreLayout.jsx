import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Boxes, Wallet, Settings } from 'lucide-react';
import { LanguageToggle } from '../components/LanguageToggle';

export const StoreLayout = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const isRegistrationOrPending =
    location.pathname === '/store/register' || location.pathname === '/store/pending';

  const isOrderDetail =
    location.pathname.startsWith('/store/orders/') && location.pathname !== '/store/orders';

  const hideBottomNav = isRegistrationOrPending || isOrderDetail;

  const navItems = [
    { to: '/store/orders', end: true, label: t('nav.orders'), icon: ClipboardList },
    { to: '/store/products', label: t('nav.products'), icon: Boxes },
    { to: '/store/earnings', label: t('nav.earnings'), icon: Wallet },
    { to: '/store/settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-page flex flex-col antialiased">
      {/* TopBar */}
      <header className="sticky top-0 z-40 bg-white border-b border-ink-300/50 shadow-xs">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-accent-500 text-white font-bold flex items-center justify-center text-lg shadow-sm">
              S
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-base text-ink-900 leading-tight">
                {t('app.name')}
              </span>
              <span className="text-[11px] font-medium text-accent-600 uppercase tracking-wider">
                Store Portal
              </span>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Main Content (Centred max-w-md on desktop) */}
      <main
        className={`flex-1 w-full max-w-md mx-auto px-4 py-4 ${hideBottomNav ? 'pb-8' : 'pb-28'}`}
      >
        <Outlet />
      </main>

      {/* BottomNav with 56px touch target buttons - only rendered when approved and not in onboarding */}
      {!hideBottomNav && (
        <nav
          aria-label="Store Navigation"
          className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-ink-300/60 shadow-lg md:max-w-md md:mx-auto md:rounded-t-2xl"
        >
          <div className="flex items-center justify-around h-20 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center flex-1 h-14 min-h-[56px] py-1 gap-1 text-xs transition-colors rounded-xl ${
                      isActive
                        ? 'text-primary-600 font-bold bg-primary-50'
                        : 'text-ink-600 hover:text-ink-900'
                    }`
                  }
                >
                  <Icon className="w-6 h-6 stroke-[2.2]" />
                  <span className="truncate max-w-[72px] text-[13px]">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};
