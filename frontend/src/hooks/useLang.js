import { useLocation } from 'react-router-dom';
import { DEFAULT_LANG, isLang } from '../i18n';

// Current language from the URL prefix (/fr, /en, /pt), plus a helper that prefixes paths with it.
export function useLang() {
  const { pathname } = useLocation();
  const prefix = pathname.split('/')[1];
  const current = isLang(prefix) ? prefix : DEFAULT_LANG;
  const to = (path = '') => `/${current}${path.startsWith('/') || path === '' ? path : `/${path}`}`;
  return { lang: current, to };
}

export function formatDate(iso, lang) {
  const locale = { fr: 'fr-FR', en: 'en-GB', pt: 'pt-BR' }[lang] ?? 'fr-FR';
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
