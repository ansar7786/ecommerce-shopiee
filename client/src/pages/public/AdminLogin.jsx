import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast, Button, Card, Input } from '../../components/ui';
import { LanguageToggle } from '../../components/LanguageToggle';

export const AdminLogin = () => {
  const { t } = useTranslation();
  const { adminLogin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast({ type: 'error', message: t('auth.invalidCredentials') });
      return;
    }

    try {
      setLoading(true);
      await adminLogin({
        username: username.trim().toLowerCase(),
        password,
      });
      showToast({ type: 'success', message: t('auth.loginSuccess') });
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      const code = err.response?.data?.code;
      let msg = t('auth.invalidCredentials');
      if (code === 'ACCOUNT_BLOCKED') {
        msg = t('auth.accountBlocked');
      } else if (code === 'RATE_LIMIT_EXCEEDED') {
        msg = t('auth.tooManyAttempts');
      } else if (code === 'INVALID_CREDENTIALS') {
        msg = t('auth.invalidCredentials');
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (!err.response) {
        msg = 'Cannot connect to server. Please check your network connection.';
      }
      showToast({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col justify-between p-4 sm:p-6 antialiased">
      {/* Top Bar */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between py-2">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-ink-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('auth.backToLogin')}</span>
        </Link>
        <LanguageToggle />
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <Card className="shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Shield className="w-8 h-8 stroke-[2.2]" />
          </div>

          <h1 className="text-2xl font-extrabold text-ink-900 text-center tracking-tight">
            {t('auth.adminLoginTitle')}
          </h1>
          <p className="text-sm text-ink-600 text-center mt-1.5 mb-6 max-w-xs mx-auto">
            {t('app.name')} — Super Admin Portal
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />

            <div className="relative">
              <Input
                label={t('auth.password')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full min-h-[48px] mt-2 font-bold"
              loading={loading}
            >
              {t('auth.loginTab')}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-ink-300/40 text-center">
            <Link
              to="/login"
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 underline underline-offset-4"
            >
              {t('auth.backToLogin')}
            </Link>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-xs text-ink-600">
        &copy; {new Date().getFullYear()} Locart. CSP Prototype.
      </footer>
    </div>
  );
};

