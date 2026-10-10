import { useAuth } from '../../context/AuthContext';
import { Button, Card, Badge } from '../../components/ui';
import { LogOut, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export const StorePlaceholder = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center font-bold">
              <Store className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink-900">{user?.name || 'Store Owner'}</h2>
              <p className="text-xs text-ink-600">
                {user?.email || ''} • {user?.phone || ''}
              </p>
            </div>
          </div>
          <Badge variant="packing">STORE OWNER</Badge>
        </div>

        <p className="text-sm text-ink-600 mb-6">
          Store Portal: Manage live incoming orders, toggle product stock, and monitor daily
          earnings.
        </p>

        <Button
          variant="danger"
          size="lg"
          className="w-full"
          leftIcon={LogOut}
          onClick={handleLogout}
        >
          {t('auth.logout')}
        </Button>
      </Card>
    </div>
  );
};
