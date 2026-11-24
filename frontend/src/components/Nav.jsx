import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons';
import { LANGUAGES } from '../i18n';
import { useLang } from '../hooks/useLang';

function LanguageSwitch() {
  const { lang } = useLang();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();

  const switchTo = (code) => {
    try {
      localStorage.setItem('lang', code);
    } catch {
      // ignore: preference just won't persist
    }
    navigate(pathname.replace(/^\/(fr|en|pt)(?=\/|$)/, `/${code}`) + hash);
  };

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGUAGES.map((l) => (
        <button key={l.code} type="button" aria-pressed={l.code === lang} title={l.label} onClick={() => switchTo(l.code)}>
          {l.short}
        </button>
      ))}
    </div>
  );
}

export default function Nav() {
  const { t } = useTranslation();
  const { to } = useLang();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { path: '/services', label: t('nav.services') },
    { path: '/actualites', label: t('nav.news') },
    { path: '/projets/cshell', label: t('nav.cshell') },
    { path: '/fabrication', label: t('nav.fabrication') },
    { path: '/rejoindre', label: t('nav.join') },
  ];

  return (
    <header className="nav">
      <nav className="container container--wide nav__inner" aria-label="Main">
        <Link to={to('')} className="nav__brand">
          <img src="/img/emblem.png" alt="" />
          FabriCS
        </Link>

        <ul className={`nav__links ${open ? 'open' : ''}`}>
          {links.map((l) => (
            <li key={l.path}>
              <NavLink to={to(l.path)}>{l.label}</NavLink>
            </li>
          ))}
        </ul>

        <div className="nav__actions">
          <LanguageSwitch />
          <Link to={to('/rejoindre#contact')} className="btn btn--primary btn--sm nav__cta">
            {t('cta.button')}
          </Link>
          <button
            type="button"
            className="nav__toggle"
            aria-expanded={open}
            aria-label={t('nav.menu')}
            onClick={() => setOpen((o) => !o)}
          >
            <FontAwesomeIcon icon={open ? faXmark : faBars} />
          </button>
        </div>
      </nav>
    </header>
  );
}
