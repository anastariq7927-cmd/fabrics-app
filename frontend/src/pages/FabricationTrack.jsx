import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLink,
  faCheck,
  faLock,
  faCircleInfo,
  faCircleXmark,
  faLocationDot,
  faClockRotateLeft,
  faReceipt,
} from '@fortawesome/free-solid-svg-icons';
import { useLang, formatDate } from '../hooks/useLang';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import Icon from '../components/Icon';
import { ArrowLink, LoadState } from '../components/Blocks';
import { QuoteBreakdown, SpecGrid, StatusPill, StatusRibbon, Timeline } from '../fabrication/parts';
import { formatBytes, formatEUR } from '../fabrication/pricing';

function CopyLink() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: nothing to do, the URL is in the address bar
    }
  };
  return (
    <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
      <FontAwesomeIcon icon={copied ? faCheck : faLink} />
      {copied ? t('fab.track.copied') : t('fab.track.copy')}
    </button>
  );
}

export default function FabricationTrack() {
  const { t } = useTranslation();
  const { token } = useParams();
  const { lang, to } = useLang();
  const state = useApi((signal) => api.fabrication.track(token, lang, { signal }), [token, lang]);
  const r = state.data;

  if (state.error?.status === 404)
    return (
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">{t('fab.track.eyebrow')}</span>
          <h1 className="headline">{t('fab.track.notFound')}</h1>
          <p style={{ marginTop: 24 }}>
            <ArrowLink to={to('/fabrication')}>{t('fab.newRequest')}</ArrowLink>
          </p>
        </div>
      </section>
    );

  return (
    <section className="section section--alt fab">
      <div className="container container--wide">
        <LoadState {...state}>
          {r && (
            <div className="track">
              <header className="panel track__head">
                <div>
                  <span className="eyebrow">{t('fab.track.eyebrow')}</span>
                  <div className="track__title">
                    <h1 className="headline mono">{r.reference}</h1>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="muted small track__meta">
                    <span>
                      <Icon name={r.service.icon} /> {r.service.title}
                    </span>
                    <span>
                      {r.name} · {t(`fab.tiers.${r.tier}`)}
                    </span>
                    <span>
                      {t('fab.track.updated')} {new Date(r.updatedAt).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </p>
                </div>
                <CopyLink />
              </header>

              {r.status === 'needs_info' && (
                <div className="alert alert--warn">
                  <FontAwesomeIcon icon={faCircleInfo} /> {t('fab.track.needsInfo')}
                </div>
              )}
              {r.status === 'rejected' && (
                <div className="alert alert--error">
                  <FontAwesomeIcon icon={faCircleXmark} /> {t('fab.track.rejected')}
                </div>
              )}
              {r.status === 'ready' && (
                <div className="alert alert--success">
                  <FontAwesomeIcon icon={faLocationDot} /> {t('fab.track.pickup')}
                </div>
              )}

              <div className="panel">
                <StatusRibbon status={r.status} events={r.events} />
              </div>

              <div className="fab-layout fab-layout--track">
                <div className="fab-layout__main">
                  <div className="panel">
                    <h2 className="title small-title">{t('fab.track.part')}</h2>
                    <SpecGrid
                      items={[
                        { label: t('fab.material'), value: r.material?.name },
                        { label: t('fab.color'), value: r.color },
                        { label: t('fab.infill'), value: r.infill !== null ? `${r.infill} %` : null },
                        { label: t('fab.layer'), value: r.layerHeight ? `${r.layerHeight} mm` : null },
                        { label: t('fab.quantity'), value: r.quantity },
                        { label: t('fab.deadline'), value: r.deadline ? formatDate(r.deadline, lang) : null },
                        { label: t('fab.dimensions'), value: r.bbox ? `${r.bbox.x} × ${r.bbox.y} × ${r.bbox.z} mm` : null },
                        { label: t('fab.volume'), value: r.volumeCm3 ? `${r.volumeCm3} cm³` : null },
                      ]}
                    />
                    {r.file && (
                      <p className="muted small" style={{ marginTop: 16 }}>
                        <code>{r.file.name}</code> · {formatBytes(r.file.size)}
                      </p>
                    )}
                  </div>

                  <div className="panel">
                    <h2 className="title small-title">
                      <FontAwesomeIcon icon={faClockRotateLeft} /> {t('fab.track.history')}
                    </h2>
                    <Timeline events={r.events} />
                  </div>
                </div>

                <aside className="fab-layout__side">
                  <div className="panel estimate">
                    <header className="estimate__head">
                      <span>
                        <FontAwesomeIcon icon={faReceipt} /> {t('fab.track.quote')}
                      </span>
                      {r.quote?.valid_until && (
                        <span className="muted tiny">{t('fab.track.validUntil', { date: formatDate(r.quote.valid_until, lang) })}</span>
                      )}
                    </header>
                    {r.quote ? (
                      <QuoteBreakdown quote={r.quote} />
                    ) : (
                      <>
                        {r.estimate !== null && (
                          <div className="estimate__total">
                            <span className="eyebrow">{t('fab.estimateTotal')}</span>
                            <strong className="estimate__amount">{formatEUR(r.estimate, lang)}</strong>
                          </div>
                        )}
                        <p className="muted small">{t('fab.track.waitingQuote')}</p>
                      </>
                    )}
                  </div>

                  {r.status === 'quoted' && r.paymentUrl && (
                    <div className="panel pay">
                      <a className="btn btn--primary btn--block" href={r.paymentUrl} target="_blank" rel="noreferrer">
                        <FontAwesomeIcon icon={faLock} />
                        {t('fab.track.pay', { amount: formatEUR(r.quote.total, lang) })}
                      </a>
                      <p className="muted tiny center">{t('fab.track.payHint')}</p>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          )}
        </LoadState>
      </div>
    </section>
  );
}
