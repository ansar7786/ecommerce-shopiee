import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import te from './te.json';

const STORAGE_KEY = 'kirana_language';
const savedLanguage = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : 'en';
const initialLang = savedLanguage === 'te' ? 'te' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    te: { translation: te },
  },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language;
}

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lng);
    document.documentElement.lang = lng;
  }
});

export default i18n;
