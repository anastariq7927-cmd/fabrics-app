import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBoxArchive, faEnvelopeOpen, faReply } from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { LoadState } from '../components/Blocks';

const FILTERS = ['', 'new', 'read', 'archived'];

export default function MessagesAdmin({ token }) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState('new');
  const state = useApi(() => api.admin.messages(token, filter || undefined), [filter]);

  async function setStatus(msg, status) {
    await api.admin.updateMessage(token, msg.id, status);
    state.retry();
  }

  return (
    <>
      <div className="admin__head">
        <h1 className="headline">{t('admin.messages')}</h1>
        <div className="tabs" role="group">
          {FILTERS.map((f) => (
            <button key={f || 'all'} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {t(`admin.status.${f || 'all'}`)}
            </button>
          ))}
        </div>
      </div>

      <LoadState {...state}>
        <div className="list">
          {state.data?.length === 0 && <p className="state">{t('admin.empty')}</p>}
          {state.data?.map((msg) => (
            <div key={msg.id} className="list__item">
              <div style={{ minWidth: 0 }}>
                <div className="card__meta">
                  <span className={`dot ${msg.status === 'new' ? 'dot--new' : ''}`} />
                  {new Date(msg.created_at).toLocaleString(i18n.language)} · {t(`form.intentions.${msg.intention}`)} ·{' '}
                  {msg.locale.toUpperCase()}
                </div>
                <strong style={{ display: 'block', marginTop: 6 }}>
                  {msg.name} <span className="muted" style={{ fontWeight: 400 }}>&lt;{msg.email}&gt;</span>
                </strong>
                <p style={{ marginTop: 8, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{msg.message}</p>
              </div>
              <div className="list__actions">
                <a className="btn btn--ghost btn--sm" href={`mailto:${msg.email}`} title={t('admin.reply')}>
                  <FontAwesomeIcon icon={faReply} />
                </a>
                {msg.status === 'new' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(msg, 'read')} title={t('admin.markRead')}>
                    <FontAwesomeIcon icon={faEnvelopeOpen} />
                  </button>
                )}
                {msg.status !== 'archived' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(msg, 'archived')} title={t('admin.archive')}>
                    <FontAwesomeIcon icon={faBoxArchive} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </LoadState>
    </>
  );
}
