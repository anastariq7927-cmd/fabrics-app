import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { LANGUAGES } from '../i18n';
import { LoadState } from '../components/Blocks';

const blank = () => ({
  slug: '',
  published_at: new Date().toISOString().slice(0, 10),
  source: 'fabrics',
  title: { fr: '', en: '', pt: '' },
  summary: { fr: '', en: '', pt: '' },
  external_url: '',
  image_url: '',
  is_published: true,
});

function NewsForm({ initial, onCancel, onSave }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [tab, setTab] = useState('fr');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setLocalized = (key, value) => setForm((f) => ({ ...f, [key]: { ...f[key], [tab]: value } }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        slug: form.slug,
        published_at: form.published_at,
        source: form.source,
        title: form.title,
        summary: form.summary,
        external_url: form.external_url || null,
        image_url: form.image_url || null,
        is_published: form.is_published,
      });
    } catch (err) {
      const details = err.body?.details ? ` — ${Object.keys(err.body.details).join(', ')}` : '';
      setError(`${err.message}${details}`);
      setBusy(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit} style={{ marginBottom: 24 }}>
      <div className="form-row">
        <div className="field">
          <label>{t('admin.fields.slug')}</label>
          <input className="input" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
        </div>
        <div className="field">
          <label>{t('admin.fields.date')}</label>
          <input className="input" type="date" required value={form.published_at} onChange={(e) => set('published_at', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>{t('admin.fields.source')}</label>
          <select className="input" value={form.source} onChange={(e) => set('source', e.target.value)}>
            {['fabrics', 'linkedin', 'press'].map((s) => (
              <option key={s} value={s}>
                {t(`news.sources.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t('admin.fields.isPublished')}</label>
          <select className="input" value={String(form.is_published)} onChange={(e) => set('is_published', e.target.value === 'true')}>
            <option value="true">{t('admin.published')}</option>
            <option value="false">{t('admin.draft')}</option>
          </select>
        </div>
      </div>

      <div className="tabs lang-tabs" role="group">
        {LANGUAGES.map((l) => (
          <button key={l.code} type="button" aria-pressed={tab === l.code} onClick={() => setTab(l.code)}>
            {l.short}
          </button>
        ))}
      </div>
      <div className="field">
        <label>
          {t('admin.fields.title')} ({tab.toUpperCase()})
        </label>
        <input className="input" required={tab === 'fr'} value={form.title[tab] ?? ''} onChange={(e) => setLocalized('title', e.target.value)} />
      </div>
      <div className="field">
        <label>
          {t('admin.fields.summary')} ({tab.toUpperCase()})
        </label>
        <textarea className="input" required={tab === 'fr'} value={form.summary[tab] ?? ''} onChange={(e) => setLocalized('summary', e.target.value)} />
      </div>

      <div className="form-row">
        <div className="field">
          <label>{t('admin.fields.url')}</label>
          <input className="input" type="url" value={form.external_url ?? ''} onChange={(e) => set('external_url', e.target.value)} />
        </div>
        <div className="field">
          <label>{t('admin.fields.image')}</label>
          <input className="input" placeholder="/img/…" value={form.image_url ?? ''} onChange={(e) => set('image_url', e.target.value)} />
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {t('admin.save')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          {t('admin.cancel')}
        </button>
      </div>
    </form>
  );
}

export default function NewsAdmin({ token }) {
  const { t, i18n } = useTranslation();
  // No token in deps: a refreshed token must not reload the page (and wipe an open form).
  const state = useApi(() => api.admin.news(token), []);
  const [editing, setEditing] = useState(null); // null | 'new' | news row

  const lang = i18n.language;
  const close = () => {
    setEditing(null);
    state.retry();
  };

  async function save(body) {
    if (editing === 'new') await api.admin.createNews(token, body);
    else await api.admin.updateNews(token, editing.id, body);
    close();
  }

  async function remove(item) {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    await api.admin.deleteNews(token, item.id);
    state.retry();
  }

  return (
    <>
      <div className="admin__head">
        <h1 className="headline">{t('admin.news')}</h1>
        {!editing && (
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            <FontAwesomeIcon icon={faPlus} />
            {t('admin.newNews')}
          </button>
        )}
      </div>

      {editing && (
        <NewsForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? blank() : { ...blank(), ...editing }}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}

      <LoadState {...state}>
        <div className="list">
          {state.data?.length === 0 && <p className="state">{t('admin.empty')}</p>}
          {state.data?.map((item) => (
            <div key={item.id} className="list__item">
              <div>
                <div className="card__meta">
                  <span className={`dot ${item.is_published ? 'dot--live' : ''}`} />
                  {item.published_at} · {t(`news.sources.${item.source}`)} · {item.is_published ? t('admin.published') : t('admin.draft')}
                </div>
                <strong style={{ display: 'block', marginTop: 6 }}>{item.title[lang] || item.title.fr}</strong>
                <span className="muted" style={{ fontSize: 13 }}>/{item.slug}</span>
              </div>
              <div className="list__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(item)} title={t('admin.edit')}>
                  <FontAwesomeIcon icon={faPen} />
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(item)} title={t('admin.delete')}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </LoadState>
    </>
  );
}
