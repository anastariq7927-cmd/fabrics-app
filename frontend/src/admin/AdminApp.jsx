import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faLock } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/supabase';
import { api } from '../api/client';
import { detectLang } from '../i18n';
import NewsAdmin from './NewsAdmin';
import MessagesAdmin from './MessagesAdmin';
import FabricationQueue from './FabricationQueue';
import FabricationInspect from './FabricationInspect';

function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(t('admin.loginError'));
    setBusy(false);
  }

  return (
    <div className="login">
      <form className="panel form" onSubmit={submit}>
        <div style={{ textAlign: 'center' }}>
          <img src="/img/emblem.png" alt="" width="44" height="44" style={{ margin: '0 auto 16px' }} />
          <h1 className="title">{t('admin.title')}</h1>
        </div>
        <div className="field">
          <label htmlFor="admin-email">Email</label>
          <input id="admin-email" type="email" className="input" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="admin-password">{t('admin.password')}</label>
          <input id="admin-password" type="password" className="input" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="alert alert--error">{error}</div>}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          <FontAwesomeIcon icon={faLock} />
          {t('admin.signIn')}
        </button>
        <Link to="/" style={{ textAlign: 'center', fontSize: 14 }}>
          ← FabriCS
        </Link>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const { t, i18n } = useTranslation();
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(null);

  useEffect(() => {
    i18n.changeLanguage(detectLang());
    // Supabase emits auth events on load, on window focus and on token refresh, each with a new
    // session object. Keep the previous one when nothing changed so the admin doesn't remount
    // (and lose a half-typed quote).
    // Both sides must exist: with no session at all, `undefined === undefined` would keep the
    // "still loading" state forever instead of showing the login screen.
    const keep = (s) => setSession((prev) => (prev && s && prev.access_token === s.access_token ? prev : (s ?? null)));
    supabase.auth.getSession().then(({ data }) => keep(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => keep(s ?? null));
    return () => data.subscription.unsubscribe();
  }, [i18n]);

  // The admin check depends on who is signed in, not on each refreshed token.
  const userId = session?.user?.id;
  const tokenRef = useRef(null);
  tokenRef.current = session?.access_token ?? null;
  useEffect(() => {
    setMe(null);
    if (userId) api.me(tokenRef.current).then(setMe).catch(() => setMe({ isAdmin: false }));
  }, [userId]);

  if (session === undefined) return <p className="state">{t('common.loading')}</p>;
  if (!session) return <Login />;
  if (!me) return <p className="state">{t('common.loading')}</p>;

  const signOut = () => supabase.auth.signOut();

  if (!me.isAdmin)
    return (
      <div className="login">
        <div className="panel" style={{ textAlign: 'center' }}>
          <p>{t('admin.notAdmin')}</p>
          <p className="muted" style={{ marginTop: 8 }}>{me.email}</p>
          <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 20 }} onClick={signOut}>
            {t('admin.signOut')}
          </button>
        </div>
      </div>
    );

  const token = session.access_token;

  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="container container--wide">
          <Link to="/" className="nav__brand">
            <img src="/img/emblem.png" alt="" />
            Admin
          </Link>
          <nav className="tabs">
            {/* Absolute paths: relative links under the /admin/* splat resolve against the current URL. */}
            <NavLink to="/admin/news">{t('admin.news')}</NavLink>
            <NavLink to="/admin/messages">{t('admin.messages')}</NavLink>
            <NavLink to="/admin/fabrication">{t('fab.admin.title')}</NavLink>
          </nav>
          <button type="button" className="btn btn--ghost btn--sm" onClick={signOut} title={me.email}>
            <FontAwesomeIcon icon={faArrowRightFromBracket} />
            <span className="sr-only">{t('admin.signOut')}</span>
          </button>
        </div>
      </header>
      <main className="admin__main container container--wide">
        <Routes>
          <Route index element={<Navigate to="/admin/news" replace />} />
          <Route path="news" element={<NewsAdmin token={token} />} />
          <Route path="messages" element={<MessagesAdmin token={token} />} />
          <Route path="fabrication" element={<FabricationQueue token={token} />} />
          <Route path="fabrication/:id" element={<FabricationInspect token={token} />} />
        </Routes>
      </main>
    </div>
  );
}
