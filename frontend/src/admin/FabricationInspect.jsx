import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCircleQuestion,
  faBan,
  faDownload,
  faCircleCheck,
  faCircleExclamation,
  faPlus,
  faTrash,
  faBolt,
  faReceipt,
  faEnvelope,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { formatDate } from '../hooks/useLang';
import { LoadState } from '../components/Blocks';
import Icon from '../components/Icon';
import ModelViewer from '../fabrication/ModelViewer';
import { loadGeometry, measure, PREVIEWABLE } from '../fabrication/analyzeMesh';
import { estimate, formatBytes, formatEUR } from '../fabrication/pricing';
import { SpecGrid, StatusPill, StatusRibbon, Timeline } from '../fabrication/parts';

const NEXT_ACTIONS = {
  submitted: [['in_review', 'startReview']],
  needs_info: [['in_review', 'startReview']],
  quoted: [['paid', 'markPaid']],
  paid: [['in_production', 'startProduction']],
  in_production: [['ready', 'markReady']],
  ready: [['delivered', 'markDelivered']],
};

function Modal({ title, icon, tone, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__card panel">
        <header className="modal__head">
          <h3 className={`title small-title tone-${tone}`}>
            <FontAwesomeIcon icon={icon} /> {title}
          </h3>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

// Messages go to the client, so templates and reasons are written in the client's language
// (`locale`), while the modal itself stays in the admin's language.
function ClarifyModal({ locale, onClose, onSend }) {
  const { t, i18n } = useTranslation();
  const tClient = i18n.getFixedT(locale);
  const [template, setTemplate] = useState('custom');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={t('fab.admin.clarifyTitle')} icon={faCircleQuestion} tone="warn" onClose={onClose}>
      <p className="muted small">{t('fab.admin.clarifyHint')}</p>
      <div className="field">
        <label>{t('fab.admin.template')}</label>
        <select
          className="input"
          value={template}
          onChange={(e) => {
            setTemplate(e.target.value);
            if (e.target.value !== 'custom') setText(tClient(`fab.admin.templates.${e.target.value}`));
          }}
        >
          {['custom', 'inserts', 'material', 'orientation'].map((k) => (
            <option key={k} value={k}>
              {k === 'custom' ? t('fab.admin.templates.custom') : t(`fab.admin.templates.${k}`).slice(0, 60) + '…'}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>{t('fab.admin.messageToClient')}</label>
        <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!text.trim() || busy}
          onClick={async () => {
            setBusy(true);
            await onSend(text.trim());
          }}
        >
          {t('fab.admin.send')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {t('fab.admin.cancel')}
        </button>
      </div>
    </Modal>
  );
}

function RejectModal({ locale, onClose, onSend }) {
  const { t, i18n } = useTranslation();
  const tClient = i18n.getFixedT(locale);
  const [reason, setReason] = useState('size');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={t('fab.admin.rejectTitle')} icon={faBan} tone="error" onClose={onClose}>
      <div className="alert alert--error small">{t('fab.admin.rejectWarning')}</div>
      <div className="field">
        <label>{t('fab.admin.reason')}</label>
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {['size', 'safety', 'deadline', 'conduct'].map((k) => (
            <option key={k} value={k}>
              {t(`fab.admin.reasons.${k}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>{t('fab.admin.details')}</label>
        <textarea className="input" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1500} />
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn btn--danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSend([tClient(`fab.admin.reasons.${reason}`), details.trim()].filter(Boolean).join('\n\n'));
          }}
        >
          {t('fab.admin.confirmReject')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {t('fab.admin.cancel')}
        </button>
      </div>
    </Modal>
  );
}

function FilePreview({ request }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ status: 'idle' });
  const previewable = request.file_format && PREVIEWABLE.includes(request.file_format) && request.fileUrl;

  useEffect(() => {
    if (!previewable) return undefined;
    let cancelled = false;
    setState({ status: 'loading' });
    fetch(request.fileUrl)
      .then((res) => res.blob())
      .then((blob) => loadGeometry(new File([blob], request.file_name)))
      .then((geometry) => !cancelled && setState({ status: 'done', geometry, metrics: measure(geometry) }))
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [previewable, request.fileUrl, request.file_name]);

  if (!request.file_name) return null;
  const metrics = state.metrics;

  return (
    <div className="panel">
      <div className="file-card__row">
        <span className="file-card__icon">
          <Icon name="cube" />
        </span>
        <div className="file-card__info">
          <strong className="file-card__name">{request.file_name}</strong>
          <span className="muted small">
            {formatBytes(request.file_size)} · {request.file_format?.toUpperCase()}
          </span>
        </div>
        {request.fileUrl && (
          <a className="btn btn--ghost btn--sm" href={request.fileUrl} download={request.file_name}>
            <FontAwesomeIcon icon={faDownload} /> {t('fab.admin.download')}
          </a>
        )}
      </div>
      {state.status === 'loading' && <p className="muted small">{t('fab.analyzing')}</p>}
      {state.status === 'error' && <p className="muted small">{t('fab.analysisError')}</p>}
      {state.status === 'done' && (
        <>
          <ModelViewer geometry={state.geometry} bbox={metrics.bbox} label={`${metrics.triangles.toLocaleString()} ${t('fab.triangles')}`} />
          <h4 className="eyebrow" style={{ marginTop: 16 }}>
            {t('fab.admin.checks')}
          </h4>
          <div className="metrics">
            <div className="metric">
              <span className="metric__label">{t('fab.mesh')}</span>
              <span className={`metric__value ${metrics.watertight ? 'is-ok' : 'is-warn'}`}>
                <FontAwesomeIcon icon={metrics.watertight ? faCircleCheck : faCircleExclamation} />{' '}
                {metrics.watertight ? t('fab.watertight') : t('fab.notWatertight')}
              </span>
            </div>
            <div className="metric">
              <span className="metric__label">{t('fab.dimensions')}</span>
              <span className="metric__value mono">
                {metrics.bbox.x} × {metrics.bbox.y} × {metrics.bbox.z} mm
              </span>
            </div>
            <div className="metric">
              <span className="metric__label">{t('fab.volume')}</span>
              <span className="metric__value mono">{metrics.volume_cm3} cm³</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuoteEngine({ request, catalog, onSubmit }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const settings = catalog.settings;
  const material = catalog.materials.find((m) => m.key === request.material_key);

  const initialLines = useMemo(() => {
    if (request.quote?.lines?.length) return request.quote.lines;
    const est =
      request.volume_cm3 && material
        ? estimate({
            volumeCm3: Number(request.volume_cm3),
            material,
            infill: request.infill ?? 25,
            quantity: request.quantity,
            setupFee: settings.setupFee,
            discountRate: 0,
          })
        : null;
    return [
      { label: `${t('fab.admin.defaultLines.material')}${material ? ` — ${material.name}` : ''}`, amount: est?.material ?? 0 },
      { label: t('fab.admin.defaultLines.setup'), amount: settings.setupFee },
      { label: t('fab.admin.defaultLines.post'), amount: 0 },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id]);

  const [lines, setLines] = useState(initialLines);
  const [rate, setRate] = useState(request.quote?.discount_rate ?? Number(settings.discounts[request.tier] ?? 0));
  // A quote that already has a link keeps it; new quotes start from the association's default.
  const [paymentUrl, setPaymentUrl] = useState(request.payment_url ?? settings.defaultPaymentUrl ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const gross = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const discount = gross * rate;
  const total = gross - discount;

  const update = (i, key, value) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [key]: value } : l)));

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        lines: lines.filter((l) => l.label.trim()).map((l) => ({ label: l.label.trim(), amount: Number(l.amount) || 0 })),
        discount_rate: rate,
        payment_url: paymentUrl.trim() || null,
        message: message.trim() || undefined,
      });
    } catch (err) {
      const details = err.body?.details ? Object.entries(err.body.details).map(([k, v]) => `${k}: ${v}`).join(' · ') : err.message;
      setError(details);
    }
    setBusy(false);
  }

  return (
    <div className="panel quote-engine">
      <header className="estimate__head">
        <span>
          <FontAwesomeIcon icon={faReceipt} /> {t('fab.admin.quoteEngine')}
        </span>
        {request.estimate_eur && (
          <span className="muted tiny">
            {t('fab.admin.estimateWas')} : {formatEUR(request.estimate_eur, lang)}
          </span>
        )}
      </header>

      <div className="quote-lines">
        {lines.map((l, i) => (
          <div key={i} className="quote-line">
            <input className="input" aria-label={t('fab.admin.lineLabel')} value={l.label} onChange={(e) => update(i, 'label', e.target.value)} />
            <input
              className="input mono"
              type="number"
              step="0.5"
              aria-label={t('fab.admin.amount')}
              value={l.amount}
              onChange={(e) => update(i, 'amount', e.target.value)}
            />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="×">
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLines((ls) => [...ls, { label: '', amount: 0 }])}>
          <FontAwesomeIcon icon={faPlus} /> {t('fab.admin.addLine')}
        </button>
      </div>

      <div className="field">
        <label>{t('fab.admin.discount')}</label>
        <div className="radio-list">
          {Object.entries(settings.discounts).map(([tier, value]) => (
            <label key={tier} className={`radio-row ${rate === Number(value) ? 'is-checked' : ''}`}>
              <input type="radio" name="discount" checked={rate === Number(value)} onChange={() => setRate(Number(value))} />
              <span>{t(`fab.tiers.${tier}`)}</span>
              <span className="mono accent">−{Math.round(value * 100)} %</span>
            </label>
          ))}
        </div>
      </div>

      <div className="breakdown">
        <div className="breakdown__row">
          <span>{t('fab.admin.gross')}</span>
          <span>{formatEUR(gross, lang)}</span>
        </div>
        <div className="breakdown__row breakdown__row--accent">
          <span>
            {t('fab.discountLine')} (−{Math.round(rate * 100)} %)
          </span>
          <span>−{formatEUR(discount, lang)}</span>
        </div>
        <div className="breakdown__total">
          <span>{t('fab.admin.total')}</span>
          <strong>{formatEUR(total, lang)}</strong>
        </div>
      </div>

      <div className="field">
        <label htmlFor="pay-url">{t('fab.admin.paymentUrl')}</label>
        <input
          id="pay-url"
          className="input"
          type="url"
          placeholder="https://www.helloasso.com/associations/fabrics-metz/…"
          value={paymentUrl}
          onChange={(e) => setPaymentUrl(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="quote-msg">{t('fab.admin.messageToClient')}</label>
        <textarea id="quote-msg" className="input input--short" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
      </div>

      {error && <div className="alert alert--error small">{error}</div>}
      <button type="button" className="btn btn--primary btn--block" disabled={busy || !lines.length} onClick={send}>
        <FontAwesomeIcon icon={faBolt} /> {t('fab.admin.sendQuote')}
      </button>

      <div className="email-preview">
        <span className="eyebrow">
          <FontAwesomeIcon icon={faEnvelope} /> {t('fab.admin.emailPreview')}
        </span>
        <p className="small">
          <strong>{request.email}</strong> · [FabriCS] {request.reference}
        </p>
        <p className="small muted">
          {formatEUR(total, lang)} · {paymentUrl ? 'HelloAsso ✓' : 'HelloAsso —'}
          {message ? ` · “${message.slice(0, 80)}${message.length > 80 ? '…' : ''}”` : ''}
        </p>
      </div>
    </div>
  );
}

export default function FabricationInspect({ token }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { id } = useParams();
  // No token in deps: a refreshed token must not reload the page (and wipe a half-typed quote).
  const state = useApi(() => api.admin.fabrication.get(token, id), [id]);
  const catalog = useApi((signal) => api.fabrication.catalog(lang, { signal }), [lang]);
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState(null);
  const r = state.data;

  async function run(fn) {
    setActionError(null);
    try {
      await fn();
      setModal(null);
      state.retry();
    } catch (err) {
      setActionError(err.body?.details ? Object.values(err.body.details).flat().join(' ') : err.message);
    }
  }

  const service = catalog.data?.services.find((s) => s.key === r?.service_key);
  const material = catalog.data?.materials.find((m) => m.key === r?.material_key);
  const colorName = material?.colors.find((c) => c.key === r?.color)?.name ?? r?.color;

  return (
    <LoadState {...state}>
      {r && (
        <div className="inspect">
          <div className="inspect__bar">
            <Link to="/admin/fabrication" className="btn btn--ghost btn--sm">
              <FontAwesomeIcon icon={faArrowLeft} /> {t('fab.admin.back')}
            </Link>
            <h1 className="title mono">{r.reference}</h1>
            <StatusPill status={r.status} />
            <span className="muted small">
              {r.name} · {t(`fab.tiers.${r.tier}`)}
            </span>
            <div className="inspect__actions">
              {!['rejected', 'delivered'].includes(r.status) && (
                <>
                  <button type="button" className="btn btn--ghost btn--sm tone-warn" onClick={() => setModal('clarify')}>
                    <FontAwesomeIcon icon={faCircleQuestion} /> {t('fab.admin.clarify')}
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm tone-error" onClick={() => setModal('reject')}>
                    <FontAwesomeIcon icon={faBan} /> {t('fab.admin.reject')}
                  </button>
                </>
              )}
            </div>
          </div>

          {actionError && <div className="alert alert--error small">{actionError}</div>}

          <div className="panel">
            <StatusRibbon status={r.status} events={r.events} />
          </div>

          <div className="fab-layout fab-layout--inspect">
            <div className="fab-layout__main">
              <div className="panel">
                <h2 className="title small-title">
                  {service && <Icon name={service.icon} />} {t('fab.admin.dossier')} · {service?.title}
                </h2>
                <SpecGrid
                  items={[
                    {
                      label: t('fab.profileLabel'),
                      value: r.profile ? `${t(`fab.profiles.${r.profile}`)}${r.profile_other ? ` — ${r.profile_other}` : ''}` : null,
                    },
                    {
                      label: t('fab.frameLabel'),
                      value: r.project_frame
                        ? `${t(`fab.frames.${r.project_frame}`)}${r.frame_other ? ` — ${r.frame_other}` : ''}${r.association_name ? ` (${r.association_name})` : ''}`
                        : null,
                    },
                    { label: t('fab.serviceOther'), value: r.service_other },
                    { label: t('form.email'), value: <a href={`mailto:${r.email}`}>{r.email}</a> },
                    { label: t('fab.phone'), value: r.phone },
                    { label: t('fab.organization'), value: r.organization },
                    { label: t('fab.material'), value: material?.name },
                    { label: t('fab.color'), value: colorName },
                    { label: t('fab.infill'), value: r.infill !== null ? `${r.infill} %` : null },
                    { label: t('fab.layer'), value: r.layer_height ? `${r.layer_height} mm` : null },
                    { label: t('fab.quantity'), value: r.quantity },
                    { label: t('fab.deadline'), value: r.deadline ? formatDate(r.deadline, lang) : null },
                  ]}
                />
                {r.notes && <blockquote className="quote-block">{r.notes}</blockquote>}
              </div>

              <FilePreview request={r} />

              <div className="panel">
                <h2 className="title small-title">{t('fab.admin.events')}</h2>
                <form
                  className="note-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (note.trim()) run(() => api.admin.fabrication.addNote(token, r.id, note.trim()).then(() => setNote('')));
                  }}
                >
                  <input className="input" placeholder={t('fab.admin.internalNote')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
                  <button type="submit" className="btn btn--primary btn--sm">
                    {t('fab.admin.addNote')}
                  </button>
                </form>
                <Timeline events={r.events} showActor />
              </div>
            </div>

            <aside className="fab-layout__side">
              {NEXT_ACTIONS[r.status] && (
                <div className="panel">
                  <h2 className="title small-title">{t('fab.admin.actions')}</h2>
                  <div className="btn-row" style={{ marginTop: 12 }}>
                    {NEXT_ACTIONS[r.status].map(([status, label]) => (
                      <button
                        key={status}
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => run(() => api.admin.fabrication.setStatus(token, r.id, status))}
                      >
                        {t(`fab.admin.${label}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {catalog.data && !['rejected', 'delivered'].includes(r.status) && (
                <QuoteEngine
                  key={r.id + (r.quote ? r.updated_at : '')}
                  request={r}
                  catalog={catalog.data}
                  onSubmit={(body) => api.admin.fabrication.quote(token, r.id, body).then(() => state.retry())}
                />
              )}
            </aside>
          </div>

          {modal === 'clarify' && (
            <ClarifyModal
              locale={r.locale}
              onClose={() => setModal(null)}
              onSend={(message) => run(() => api.admin.fabrication.setStatus(token, r.id, 'needs_info', message))}
            />
          )}
          {modal === 'reject' && (
            <RejectModal
              locale={r.locale}
              onClose={() => setModal(null)}
              onSend={(message) => run(() => api.admin.fabrication.setStatus(token, r.id, 'rejected', message))}
            />
          )}
        </div>
      )}
    </LoadState>
  );
}
