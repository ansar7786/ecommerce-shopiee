import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Lock,
  Unlock,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  useToast,
  Card,
  Button,
  Badge,
  Skeleton,
  EmptyState,
  BottomSheet,
} from '../../components/ui';

export const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const { i18n } = useTranslation();
  const { showToast } = useToast();
  const isTe = i18n.language === 'te';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Confirm Sheet state
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchUsers = useCallback(async (query = '') => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/admin/users', {
        params: query ? { q: query } : {},
      });
      setUsers(res.data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(searchQuery);
  }, [fetchUsers, searchQuery]);

  const handleToggleBlock = async () => {
    if (!selectedUser || actionInProgress) return;

    try {
      setActionInProgress(true);
      const newBlockedState = !selectedUser.isBlocked;
      await api.patch(`/admin/users/${selectedUser._id}`, {
        isBlocked: newBlockedState,
      });

      showToast({
        type: 'success',
        message: isTe
          ? `వినియోగదారుడు విజయవంతంగా ${newBlockedState ? 'బ్లాక్' : 'అన్‌బ్లాక్'} చేయబడ్డారు`
          : `User successfully ${newBlockedState ? 'blocked' : 'unblocked'}`,
      });

      setConfirmSheetOpen(false);
      setSelectedUser(null);
      fetchUsers(searchQuery);
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update user status',
      });
    } finally {
      setActionInProgress(false);
    }
  };

  const isSelf = (u) => String(u._id) === String(currentUser?._id);
  const isAdmin = (u) => u.role === 'admin';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 antialiased">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-900 tracking-tight">
            {isTe ? 'వినియోగదారుల నిర్వహణ' : 'User Accounts'}
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">
            {isTe
              ? 'నమోదైన వినియోగదారులను శోధించండి, పాత్రలను చూడండి మరియు ఖాతా భద్రతను నిర్వహించండి'
              : 'Search customers and store owners, manage access and security'}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fetchUsers(searchQuery)}
          className="text-xs font-bold self-start sm:self-auto flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isTe ? 'రిఫ్రెష్' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-ink-200 shadow-xs flex items-center gap-2.5">
        <Search className="w-4 h-4 text-ink-400 shrink-0 ml-1" />
        <input
          type="text"
          placeholder={
            isTe
              ? 'పేరు, ఈమెయిల్ లేదా ఫోన్ నంబర్ ద్వారా శోధించండి...'
              : 'Search by user name, email, or phone...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs font-medium bg-transparent outline-none placeholder:text-ink-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-[11px] font-bold text-ink-400 hover:text-ink-700 px-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Users Table / List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="pt-8 max-w-md mx-auto">
          <EmptyState
            icon={AlertTriangle}
            title={isTe ? 'లోడ్ చేయడం విఫలమైంది' : 'Error Loading Users'}
            description={error}
            actionLabel={isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry'}
            onAction={() => fetchUsers(searchQuery)}
          />
        </div>
      ) : users.length === 0 ? (
        <div className="pt-8">
          <EmptyState
            icon={Users}
            title={isTe ? 'వినియోగదారులు కనుగొనబడలేదు' : 'No Users Found'}
            description={
              searchQuery
                ? isTe
                  ? 'మీ శోధనకు సరిపోలే వినియోగదారులు ఎవరూ లేరు.'
                  : 'No users matched your query. Try a different search term.'
                : isTe
                  ? 'ఇంకా ఎటువంటి వినియోగదారులు నమోదు కాలేదు.'
                  : 'No users registered on the platform yet.'
            }
          />
        </div>
      ) : (
        <Card className="overflow-hidden border border-ink-200 rounded-2xl bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50/70 text-ink-500 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {users.map((u) => {
                  const cannotBlock = isSelf(u) || isAdmin(u);
                  return (
                    <tr key={u._id} className="hover:bg-ink-50/50 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-800 font-black text-xs flex items-center justify-center shrink-0">
                            {u.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-ink-900 block truncate">
                              {u.name}
                              {isSelf(u) && (
                                <span className="ml-1.5 text-[9px] bg-primary-100 text-primary-800 px-1.5 py-0.2 rounded font-black">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-ink-500 block truncate">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-mono text-ink-700">{u.phone || '—'}</td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        {u.role === 'admin' ? (
                          <Badge variant="primary">
                            <Shield className="w-3 h-3 mr-1 inline" /> Admin
                          </Badge>
                        ) : u.role === 'store_owner' ? (
                          <Badge variant="accent">Store Owner</Badge>
                        ) : (
                          <Badge variant="neutral">Customer</Badge>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {u.isBlocked ? (
                          <Badge variant="danger">
                            <ShieldAlert className="w-3 h-3 mr-1 inline" /> Blocked
                          </Badge>
                        ) : (
                          <Badge variant="success">
                            <ShieldCheck className="w-3 h-3 mr-1 inline" /> Active
                          </Badge>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3 px-4 text-ink-500 text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {cannotBlock ? (
                          <span className="text-[10px] text-ink-400 italic">Protected</span>
                        ) : (
                          <Button
                            type="button"
                            variant={u.isBlocked ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setConfirmSheetOpen(true);
                            }}
                            className={`text-xs font-bold min-h-[32px] ${
                              u.isBlocked
                                ? 'text-emerald-700 hover:bg-emerald-50'
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                          >
                            {u.isBlocked ? (
                              <>
                                <Unlock className="w-3.5 h-3.5 mr-1" />
                                <span>{isTe ? 'అన్‌బ్లాక్' : 'Unblock'}</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5 mr-1" />
                                <span>{isTe ? 'బ్లాక్' : 'Block'}</span>
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Block / Unblock Confirmation BottomSheet */}
      <BottomSheet
        isOpen={confirmSheetOpen}
        onClose={() => {
          if (!actionInProgress) {
            setConfirmSheetOpen(false);
            setSelectedUser(null);
          }
        }}
        title={
          selectedUser?.isBlocked
            ? isTe
              ? 'ఖాతాను అన్‌బ్లాక్ చేయాలా?'
              : 'Unblock User Account?'
            : isTe
              ? 'ఖాతాను బ్లాక్ చేయాలా?'
              : 'Block User Account?'
        }
      >
        <div className="space-y-4 pb-4">
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <p className="font-extrabold">{selectedUser?.name}</p>
              <p className="mt-0.5">
                {selectedUser?.isBlocked
                  ? isTe
                    ? 'ఈ వినియోగదారుని ఖాతాను అన్‌బ్లాక్ చేయడం ద్వారా వారు తిరిగి ప్లాట్‌ఫారమ్‌లో లాగిన్ అవ్వగలరు.'
                    : 'Unblocking this user will restore their access to login and place orders.'
                  : isTe
                    ? 'బ్లాక్ చేసిన వినియోగదారులు ప్లాట్‌ఫారమ్‌లో ఆర్డర్లు లేదా దుకాణాన్ని నిర్వహించలేరు.'
                    : 'Blocking this user will prevent them from accessing customer or store services.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={actionInProgress}
              onClick={() => {
                setConfirmSheetOpen(false);
                setSelectedUser(null);
              }}
              className="flex-1 font-bold text-xs"
            >
              {isTe ? 'రద్దు' : 'Cancel'}
            </Button>

            <Button
              type="button"
              variant={selectedUser?.isBlocked ? 'primary' : 'danger'}
              size="lg"
              disabled={actionInProgress}
              onClick={handleToggleBlock}
              className="flex-1 font-extrabold text-xs"
            >
              <span>
                {actionInProgress
                  ? isTe
                    ? 'ప్రక్రియ...'
                    : 'Updating...'
                  : selectedUser?.isBlocked
                    ? isTe
                      ? 'అవును, అన్‌బ్లాక్ చేయి'
                      : 'Yes, Unblock'
                    : isTe
                      ? 'అవును, బ్లాక్ చేయి'
                      : 'Yes, Block User'}
              </span>
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
