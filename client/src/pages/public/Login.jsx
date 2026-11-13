import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShieldAlert,
  Store,
  User,
  Shield,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast, Button, Card, Badge, Input } from '../../components/ui';
import { LanguageToggle } from '../../components/LanguageToggle';

export const Login = () => {
  const { t } = useTranslation();
  const { user, login, signup, demoLogin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Role: 'customer' | 'store_owner'
  const [role, setRole] = useState('customer');
  // Mode: 'login' | 'signup'
  const [mode, setMode] = useState('login');

  // Form fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Demo Login panel state
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      showToast({ type: 'error', message: t('auth.usernameInvalid') });
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        showToast({ type: 'error', message: t('auth.fullName') + ' is required' });
        return;
      }
      if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        showToast({ type: 'error', message: t('auth.usernameInvalid') });
        return;
      }
      if (!/^[6-9]\d{9}$/.test(phone.trim())) {
        showToast({ type: 'error', message: t('auth.invalidPhone') });
        return;
      }
      if (password.length < 6) {
        showToast({ type: 'error', message: t('auth.passwordTooShort') });
        return;
      }
      if (password !== confirmPassword) {
        showToast({ type: 'error', message: t('auth.passwordMismatch') });
        return;
      }

      try {
        setSubmitting(true);
        const u = await signup({
          name: name.trim(),
          username: cleanUsername,
          password,
          phone: phone.trim(),
          role,
        });
        showToast({ type: 'success', message: t('auth.signupSuccess') });
        navigateUser(u);
      } catch (err) {
        const code = err.response?.data?.code;
        let msg = err.response?.data?.message || t('common.somethingWentWrong');
        if (code === 'USERNAME_TAKEN') msg = t('auth.usernameTaken');
        else if (code === 'RATE_LIMIT_EXCEEDED') msg = t('auth.tooManyAttempts');
        showToast({ type: 'error', message: msg });
      } finally {
        setSubmitting(false);
      }
    } else {
      // Login mode
      if (!password) {
        showToast({ type: 'error', message: t('auth.invalidCredentials') });
        return;
      }

      try {
        setSubmitting(true);
        const u = await login({
          username: cleanUsername,
          password,
          role,
        });
        showToast({ type: 'success', message: t('auth.loginSuccess') });
        navigateUser(u);
      } catch (err) {
        const code = err.response?.data?.code;
        let msg = t('auth.invalidCredentials');
        if (code === 'ROLE_MISMATCH') msg = t('auth.roleMismatch');
        else if (code === 'ACCOUNT_BLOCKED') msg = t('auth.accountBlocked');
        else if (code === 'RATE_LIMIT_EXCEEDED') msg = t('auth.tooManyAttempts');
        showToast({ type: 'error', message: msg });
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleDemoLogin = async (demoRole) => {
    try {
      setDemoLoading(demoRole);
      const u = await demoLogin(demoRole);
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
            L
          </span>
          <span className="font-bold text-ink-900">{t('app.name')}</span>
        </div>
        <LanguageToggle />
      </div>

      {/* Main Login / Signup Card */}
      <div className="w-full max-w-md mx-auto my-auto py-4">
        <Card className="shadow-md">
          {/* Brand Icon Header */}
          <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
            {role === 'store_owner' ? (
              <Store className="w-7 h-7 stroke-[2.2]" />
            ) : (
              <ShoppingBag className="w-7 h-7 stroke-[2.2]" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-ink-900 text-center tracking-tight">
            {t('app.name')}
          </h1>
          <p className="text-xs text-ink-600 text-center mt-1 mb-4 max-w-xs mx-auto">
            {t('auth.tagline')}
          </p>

          {/* Segmented Control Role Toggle */}
          <div className="grid grid-cols-2 p-1 bg-ink-300/30 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => setRole('customer')}
              className={`py-2 text-xs font-bold rounded-lg transition-all min-h-[40px] flex items-center justify-center gap-1.5 ${
                role === 'customer'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{t('auth.roleCustomer')}</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('store_owner')}
              className={`py-2 text-xs font-bold rounded-lg transition-all min-h-[40px] flex items-center justify-center gap-1.5 ${
                role === 'store_owner'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>{t('auth.roleStore')}</span>
            </button>
          </div>

          {role === 'store_owner' && (
            <div className="text-center mb-4">
              <Badge variant="packing" className="px-3 py-1 text-xs">
                {t('auth.storeOwnerBadge')}
              </Badge>
            </div>
          )}

          {/* Login / Sign Up Tabs */}
          <div className="flex border-b border-ink-300/60 mb-4">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 pb-2 text-sm font-bold text-center border-b-2 transition-colors ${
                mode === 'login'
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-ink-600 hover:text-ink-900'
              }`}
            >
              {t('auth.loginTab')}
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 pb-2 text-sm font-bold text-center border-b-2 transition-colors ${
                mode === 'signup'
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-ink-600 hover:text-ink-900'
              }`}
            >
              {t('auth.signupTab')}
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <Input
                label={t('auth.fullName')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ramesh Kumar"
                autoComplete="name"
                required
              />
            )}

            <Input
              label={t('auth.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={role === 'store_owner' ? 'e.g. store1' : 'e.g. customer'}
              autoComplete="username"
              required
            />

            {mode === 'signup' && (
              <Input
                label={t('auth.mobileNumber')}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={10}
                required
              />
            )}

            <div className="relative">
              <Input
                label={t('auth.password')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={t('auth.showPassword')}
                className="absolute right-3 top-9 text-ink-600 hover:text-ink-900 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {mode === 'signup' && (
              <Input
                label={t('auth.confirmPassword')}
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full min-h-[48px] mt-2 font-bold"
              loading={submitting}
            >
              {mode === 'signup' ? t('auth.signupTab') : t('auth.loginTab')}
            </Button>
          </form>

          {/* Mode Switch Text Link */}
          <div className="mt-4 pt-3 border-t border-ink-300/40 text-center">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 underline underline-offset-4"
            >
              {mode === 'login' ? t('auth.newHere') : t('auth.haveAccount')}
            </button>
          </div>

          {/* Admin Login Link */}
          <div className="mt-3 text-center">
            <Link
              to="/admin/login"
              className="text-[11px] font-medium text-ink-600 hover:text-ink-900 underline underline-offset-2"
            >
              {t('auth.adminLoginLink')} &rarr;
            </Link>
          </div>
        </Card>

        {/* Dev-only Demo Quick Login Panel */}
        {import.meta.env.DEV && (
          <div className="mt-5">
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
                <div className="mt-3.5 space-y-2">
                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-xs font-semibold justify-start px-3 min-h-[44px]"
                    leftIcon={User}
                    loading={demoLoading === 'customer'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('customer')}
                  >
                    {t('auth.demoCustomer')} (customer)
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-xs font-semibold justify-start px-3 min-h-[44px]"
                    leftIcon={Store}
                    loading={demoLoading === 'store_owner'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('store_owner')}
                  >
                    Store Owner (store1 - Approved)
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-xs font-semibold justify-start px-3 min-h-[44px]"
                    leftIcon={Store}
                    loading={demoLoading === 'new_store_owner'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('new_store_owner')}
                  >
                    New Store Owner (Test 4-Step Reg)
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full text-xs font-semibold justify-start px-3 min-h-[44px]"
                    leftIcon={Shield}
                    loading={demoLoading === 'admin'}
                    disabled={demoLoading !== null}
                    onClick={() => handleDemoLogin('admin')}
                  >
                    {t('auth.demoAdmin')} (admin)
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-xs text-ink-600">
        &copy; {new Date().getFullYear()} Locart. CSP Prototype.
      </footer>
    </div>
  );
};
