/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import i18n from '../i18n';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success && res.data?.user) {
        setUser(res.data.user);
        if (res.data.user.language && i18n.language !== res.data.user.language) {
          i18n.changeLanguage(res.data.user.language);
        }
        return res.data.user;
      }
      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithGoogle = async (credential, intent = 'customer') => {
    const res = await api.post('/auth/google', { credential, intent });
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
      if (res.data.user.language) {
        i18n.changeLanguage(res.data.user.language);
      }
      return res.data.user;
    }
    throw new Error('Google login failed');
  };

  const demoLogin = async (role) => {
    const res = await api.post('/auth/demo', { role });
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
      if (res.data.user.language) {
        i18n.changeLanguage(res.data.user.language);
      }
      return res.data.user;
    }
    throw new Error('Demo login failed');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        demoLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
