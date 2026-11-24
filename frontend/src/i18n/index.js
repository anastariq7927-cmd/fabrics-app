import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './fr.json';
import en from './en.json';
import pt from './pt.json';

export const LANGUAGES = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'pt', label: 'Português', short: 'PT' },
];
export const DEFAULT_LANG = 'fr';
export const isLang = (code) => LANGUAGES.some((l) => l.code === code);

export function detectLang() {
  try {
    const saved = localStorage.getItem('lang');
    if (isLang(saved)) return saved;
  } catch {
    // storage unavailable (private mode) — fall through to the browser language
  }
  const browser = (navigator.language || '').slice(0, 2);
  return isLang(browser) ? browser : DEFAULT_LANG;
}

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en }, pt: { translation: pt } },
  lng: DEFAULT_LANG,
  fallbackLng: DEFAULT_LANG,
  interpolation: { escapeValue: false },
  returnObjects: true,
});

export default i18n;
