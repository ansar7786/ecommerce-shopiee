import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { ShieldAlert, Store, User, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast, Button, Card, Badge } from '../../components/ui';
import { LanguageToggle } from '../../components/LanguageToggle';

export const Login = () => {
  const { t } = useTranslation();
  const { user, loginWithGoogle, demoLogin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [intent, setIntent] = useState('customer'); // 'customer' | 'store'
  const [demoOpen, setDemoOpen] = useState(true);
  const [demoLoading, setDemoLoading] = useState(null);

  const navigateUser = useCallback(
    (loggedInUser) => {
      if (!loggedInUser.phone && loggedInUser.role !== 'admin') {
        navigate('/complete-profile', { replace: true });
      } else if (loggedInUser.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (loggedInUser.role === 'store_owner') {
        navigate('/store/orders', { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (user) {
      navigateUser(user);
    }
  }, [user, navigateUser]);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const u = await loginWithGoogle(credentialResponse.credential, intent);
      showToast({ type: 'success', message: t('auth.loginSuccess') });
      navigateUser(u);
    } catch (err) {
      const code = err.response?.data?.code;
      const msg = code === 'ACCOUNT_BLOCKED' ? t('auth.accountBlocked') : t('auth.googleFailed');
      showToast({ type: 'error', message: msg });
    }
  };

  const handleDemoLogin = async (role) => {
    try {
      setDemoLoading(role);
      const u = await demoLogin(role);
      showToast({ type: 'success', message: t('auth.loginSuccess') });
      navigateUser(u);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Demo login failed' });
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col justify-between p-4 sm:p-6 antialiased">
      {/* Top bar with Language Toggle */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
            K
          </span>
          <span className="font-bold text-ink-900">{t('app.name')}</span>
        </div>
        <LanguageToggle />
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <Card className="text-center shadow-md">
          {/* Brand Logo & Header */}
          <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Store className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">{t('app.name')}</h1>
          <p className="text-sm text-ink-600 mt-1.5 mb-6 max-w-xs mx-auto">{t('auth.tagline')}</p>

          {intent === 'store' && (
            <div className="mb-4">
              <Badge variant="packing" className="px-3 py-1 text-xs">
                {t('auth.storeOwnerBadge')}
              </Badge>
            </div>
          )}

          {/* Google OAuth Login Button */}
          <div className="flex flex-col items-center justify-center min-h-[48px] my-3">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => showToast({ type: 'error', message: t('auth.googleFailed') })}
              useOneTap={false}
              theme="outline"
              size="large"
              text="continue_with"
              shape="rectangular"
              width="320"
            />
          </div>

          {/* Toggle Intent Link */}
          <div className="mt-5 pt-4 border-t border-ink-300/40">
            <button
              type="button"
              onClick={() => setIntent(intent === 'store' ? 'customer' : 'store')}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 underline underline-offset-4 transition-colors"
            >
              {intent === 'store' ? t('auth.customerPrompt') : t('auth.storeOwnerPrompt')}
            </button>
          </div>
        </Card>

        {/* Dev-only Demo Login Panel */}
        {import.meta.env.DEV && (
          <div className="mt-6">
            <div className="bg-white rounded-card border border-ink-300/80 p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setDemoOpen(!demoOpen)}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-ink-600 hover:text-ink-900"
              >
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-accent-500" />
                  <span>{t('auth.demoLoginTitle')}</span>
                </div>
                {demoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {demoOpen && (
                <div className="mt-4 space-y-2.5">
                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-sm font-semibold justify-start px-4"
                    leftIcon={User}
                    loading={demoLoading === 'customer'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('customer')}
                  >
                    {t('auth.demoCustomer')}
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-sm font-semibold justify-start px-4"
                    leftIcon={Store}
                    loading={demoLoading === 'store_owner'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('store_owner')}
                  >
                    Store Owner (ikshara - Approved)
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-sm font-semibold justify-start px-4"
                    leftIcon={Store}
                    loading={demoLoading === 'new_store_owner'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('new_store_owner')}
                  >
                    New Store Owner (Test 4-Step Registration)
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-sm font-semibold justify-start px-4"
                    leftIcon={Shield}
                    loading={demoLoading === 'admin'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('admin')}
                  >
                    {t('auth.demoAdmin')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-xs text-ink-600">
        &copy; {new Date().getFullYear()} Kirana Platform. CSP Prototype.
      </footer>
    </div>
  );
};
