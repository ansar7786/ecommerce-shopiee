import { useAuth } from '../../context/AuthContext';
import { Button, Card } from '../../components/ui';
import { LogOut, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export const CustomerPlaceholder = () => {
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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-lg">
            {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink-900">{user?.name || 'Customer'}</h2>
            <p className="text-xs text-ink-600">
              {user?.email || ''} • {user?.phone || 'No phone'}
            </p>
          </div>
        </div>

        <p className="text-sm text-ink-600 mb-6">
          Customer Portal: Browse neighbourhood kirana stores, search items, and place orders.
        </p>

        <Button
          variant="danger"
          size="md"
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
