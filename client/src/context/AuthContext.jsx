/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import i18n from '../i18n';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyUserLanguage = (userObj) => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('kirana_language') : null;
    const targetLang = saved || userObj?.language || 'en';
    if (i18n.language !== targetLang) {
      i18n.changeLanguage(targetLang);
    }
  };

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success && res.data?.user) {
        setUser(res.data.user);
        applyUserLanguage(res.data.user);
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

  const login = async ({ username, password, role }) => {
    const res = await api.post('/auth/login', { username, password, role });
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
      applyUserLanguage(res.data.user);
      return res.data.user;
    }
    throw new Error('Login failed');
  };

  const signup = async ({ name, username, password, phone, role }) => {
    const res = await api.post('/auth/signup', { name, username, password, phone, role });
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
      applyUserLanguage(res.data.user);
      return res.data.user;
    }
    throw new Error('Signup failed');
  };

  const adminLogin = async ({ username, password }) => {
    const res = await api.post('/auth/admin/login', { username, password });
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
      applyUserLanguage(res.data.user);
      return res.data.user;
    }
    throw new Error('Admin login failed');
  };

  const demoLogin = async (role) => {
    const res = await api.post('/auth/demo', { role });
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
      applyUserLanguage(res.data.user);
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
        login,
        signup,
        adminLogin,
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
