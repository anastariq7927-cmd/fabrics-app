import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Nav from './Nav';
import Footer from './Footer';

// Wraps every public page under /fr, /en or /pt and keeps i18next in sync with the URL.
export default function Layout({ lang }) {
  const { i18n, t } = useTranslation();
  const { pathname, hash } = useLocation();
  // Language the tree is actually rendered in. Pages wait for i18next to switch
  // instead of relying on its change event, which can fire before they subscribe.
  const [activeLang, setActiveLang] = useState(i18n.language);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (i18n.language === lang) setActiveLang(lang);
    else i18n.changeLanguage(lang).then(() => setActiveLang(lang));
  }, [lang, i18n]);

  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);

  useEffect(() => {
    document.title = `FabriCS — ${t('home.eyebrow').split('—')[1]?.trim() ?? 'Metz'}`;
  }, [t]);

  if (activeLang !== lang) return null;

  return (
    <>
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <Nav />
      {/* Keyed by language so route pages (stable elements React would skip) re-render translated. */}
      <main id="main" key={lang}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
