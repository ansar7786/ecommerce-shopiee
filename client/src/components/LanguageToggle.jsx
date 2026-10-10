import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import api from '../api/axios';

export const LanguageToggle = ({ className = '' }) => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'en';

  const toggleLanguage = async () => {
    const nextLang = currentLang === 'te' ? 'en' : 'te';
    i18n.changeLanguage(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kirana_language', nextLang);
    }
    try {
      await api.patch('/users/me', { language: nextLang });
    } catch {
      // Ignored if user is not logged in
    }
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-ink-300 bg-white text-ink-900 hover:bg-page active:bg-ink-300/20 transition-colors shadow-sm select-none min-h-[36px] ${className}`}
      aria-label="Toggle language"
    >
      <Globe className="w-3.5 h-3.5 text-primary-600" />
      <span className="font-bold">{currentLang === 'te' ? 'తె' : 'EN'}</span>
    </button>
  );
};
