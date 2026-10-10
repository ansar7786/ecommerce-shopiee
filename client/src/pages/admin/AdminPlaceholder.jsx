import { useAuth } from '../../context/AuthContext';
import { Button, Card, Badge } from '../../components/ui';
import { LogOut, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export const AdminPlaceholder = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-ink-900 text-white flex items-center justify-center font-bold">
              <Shield className="w-6 h-6 text-accent-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink-900">{user?.name || 'Administrator'}</h2>
              <p className="text-xs text-ink-600">
                {user?.email || ''} • {user?.role || 'admin'}
              </p>
            </div>
          </div>
          <Badge variant="ready">ADMINISTRATOR</Badge>
        </div>

        <p className="text-sm text-ink-600 mb-6">
          Admin Console: Oversee store approvals, manage master catalogue, inspect complaints, and
          monitor system analytics.
        </p>

        <Button
          variant="danger"
          size="md"
          className="w-full sm:w-auto"
          leftIcon={LogOut}
          onClick={handleLogout}
        >
          {t('auth.logout')}
        </Button>
      </Card>
    </div>
  );
};
