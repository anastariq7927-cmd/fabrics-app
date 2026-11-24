import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLayerGroup,
  faHourglassHalf,
  faWallet,
  faGears,
  faBoxOpen,
  faMagnifyingGlass,
  faPaperclip,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { LoadState } from '../components/Blocks';
import Icon from '../components/Icon';
import { StatusPill } from '../fabrication/parts';
import { formatEUR } from '../fabrication/pricing';

const STATUSES = ['submitted', 'in_review', 'needs_info', 'quoted', 'paid', 'in_production', 'ready', 'delivered', 'rejected'];
const TIERS = ['', 'etudiant', 'association', 'externe'];

function Kpi({ icon, label, value, tone }) {
  return (
    <div className={`kpi kpi--${tone}`}>
      <span className="kpi__label">
        {label} <FontAwesomeIcon icon={icon} />
      </span>
      <strong className="kpi__value">{value}</strong>
    </div>
  );
}

export default function FabricationQueue({ token }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ status: '', service: '', tier: '' });
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  // Search waits for a pause in typing before hitting the API.
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const catalog = useApi((signal) => api.fabrication.catalog(lang, { signal }), [lang]);
  const state = useApi(() => api.admin.fabrication.list(token, { ...filters, q }), [filters, q]);
  const counts = state.data?.counts ?? {};
  const serviceTitle = (key) => catalog.data?.services.find((s) => s.key === key)?.title ?? key;
  const serviceIcon = (key) => catalog.data?.services.find((s) => s.key === key)?.icon;
  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <>
      <div className="admin__head">
        <h1 className="headline">{t('fab.admin.title')}</h1>
      </div>

      <div className="kpis">
        <Kpi icon={faLayerGroup} tone="neutral" label={t('fab.admin.kpi.active')} value={(state.data?.total ?? 0) - (counts.delivered ?? 0) - (counts.rejected ?? 0)} />
        <Kpi icon={faHourglassHalf} tone="warn" label={t('fab.admin.kpi.review')} value={(counts.submitted ?? 0) + (counts.in_review ?? 0) + (counts.needs_info ?? 0)} />
        <Kpi icon={faWallet} tone="neutral" label={t('fab.admin.kpi.payment')} value={counts.quoted ?? 0} />
        <Kpi icon={faGears} tone="brand" label={t('fab.admin.kpi.production')} value={(counts.paid ?? 0) + (counts.in_production ?? 0)} />
        <Kpi icon={faBoxOpen} tone="ok" label={t('fab.admin.kpi.ready')} value={counts.ready ?? 0} />
      </div>

      <div className="panel filters">
        <label className="search">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <input className="input" type="search" placeholder={t('fab.admin.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select className="input" value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">{t('fab.admin.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`fab.status.${s}`)} ({counts[s] ?? 0})
            </option>
          ))}
        </select>
        <select className="input" value={filters.service} onChange={(e) => set('service', e.target.value)}>
          <option value="">{t('fab.admin.allServices')}</option>
          {catalog.data?.services.map((s) => (
            <option key={s.key} value={s.key}>
              {s.title}
            </option>
          ))}
        </select>
        <div className="tabs" role="group">
          {TIERS.map((tier) => (
            <button key={tier || 'all'} type="button" aria-pressed={filters.tier === tier} onClick={() => set('tier', tier)}>
              {tier ? t(`fab.tiers.${tier}`) : t('fab.admin.allTiers')}
            </button>
          ))}
        </div>
      </div>

      <LoadState {...state}>
        <div className="panel table-wrap">
          {state.data?.rows.length === 0 ? (
            <p className="state">{t('fab.admin.empty')}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('fab.admin.colRef')}</th>
                  <th>{t('fab.admin.colClient')}</th>
                  <th>{t('fab.admin.colService')}</th>
                  <th>{t('fab.admin.colStatus')}</th>
                  <th className="num">{t('fab.admin.colAmount')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.data?.rows.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/admin/fabrication/${r.id}`)} className="is-clickable">
                    <td>
                      <strong className="mono accent">{r.reference}</strong>
                      <div className="muted tiny">{new Date(r.created_at).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </td>
                    <td>
                      <div className="client">
                        <span className="avatar">{r.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                        <div>
                          <strong>{r.name}</strong>
                          <div className="muted tiny">
                            {t(`fab.tiers.${r.tier}`)}
                            {r.organization ? ` · ${r.organization}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="nowrap">
                        <Icon name={serviceIcon(r.service_key)} /> {serviceTitle(r.service_key)}
                      </span>
                      {r.file_name && (
                        <div className="muted tiny file-name">
                          <FontAwesomeIcon icon={faPaperclip} /> {r.file_name}
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusPill status={r.status} />
                    </td>
                    <td className="num">
                      {r.quote ? (
                        <strong>{formatEUR(r.quote.total, lang)}</strong>
                      ) : r.estimate_eur ? (
                        <span className="muted">~{formatEUR(r.estimate_eur, lang)}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num">
                      <span className="btn btn--ghost btn--sm">
                        {t('fab.admin.open')} <FontAwesomeIcon icon={faArrowRight} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </LoadState>
    </>
  );
}
