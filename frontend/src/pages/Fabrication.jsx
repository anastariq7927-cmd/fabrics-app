import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCloudArrowUp,
  faCheck,
  faCircleCheck,
  faCircleExclamation,
  faFileLines,
  faTrash,
  faMinus,
  faPlus,
  faPaperPlane,
  faShieldHalved,
  faGraduationCap,
  faPeopleGroup,
  faBuilding,
  faCalculator,
  faClock,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../hooks/useLang';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import Icon from '../components/Icon';
import Reveal from '../components/Reveal';
import { LoadState, PageHead } from '../components/Blocks';
import ModelViewer from '../fabrication/ModelViewer';
import { loadGeometry, measure, PREVIEWABLE } from '../fabrication/analyzeMesh';
import { estimate, formatEUR, formatBytes } from '../fabrication/pricing';

const TIERS = [
  { key: 'etudiant', icon: faGraduationCap },
  { key: 'association', icon: faPeopleGroup },
  { key: 'externe', icon: faBuilding },
];
const INFILLS = [15, 25, 50, 100];
const LAYERS = ['0.12', '0.20', '0.28'];
const FILE_REQUIRED = ['impression-3d', 'laser'];
const MAX_BYTES = 50 * 1024 * 1024;

function StepPanel({ n, title, aside, children }) {
  const { t } = useTranslation();
  return (
    <section className="panel step">
      <header className="step__head">
        <span className="step__badge">
          {t('fab.step')} {String(n).padStart(2, '0')}
        </span>
        <h3>{title}</h3>
        {aside && <span className="step__aside">{aside}</span>}
      </header>
      <div className="step__body">{children}</div>
    </section>
  );
}

function ServicePicker({ services, value, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="fab-services" role="radiogroup" aria-label={t('fab.pickService')}>
      {services.map((s) => (
        <button
          key={s.key}
          type="button"
          role="radio"
          aria-checked={value === s.key}
          className={`fab-service ${value === s.key ? 'is-selected' : ''}`}
          onClick={() => onChange(s.key)}
        >
          {value === s.key && (
            <span className="fab-service__check">
              <FontAwesomeIcon icon={faCheck} /> {t('fab.selected')}
            </span>
          )}
          <span className="fab-service__icon">
            <Icon name={s.icon} />
          </span>
          <strong className="fab-service__title">{s.title}</strong>
          <span className="fab-service__text">{s.summary}</span>
          <span className="fab-service__meta">
            <FontAwesomeIcon icon={faClock} /> {s.leadTime}
          </span>
        </button>
      ))}
    </div>
  );
}

function FileStep({ service, file, analysis, color, onFile }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const accept = service.formats.map((f) => `.${f}`).join(',');

  const pick = (f) => f && onFile(f);

  return (
    <>
      {!FILE_REQUIRED.includes(service.key) && <p className="muted small">{t('fab.fileOptional')}</p>}
      {!file ? (
        <label
          className={`dropzone ${dragging ? 'is-dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          <input ref={inputRef} type="file" accept={accept} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          <span className="dropzone__icon">
            <FontAwesomeIcon icon={faCloudArrowUp} />
          </span>
          <strong>
            {t('fab.drop')} <span className="link-like">{t('fab.browse')}</span>
          </strong>
          <span className="muted small">
            {t('fab.formats')} : <code>{service.formats.map((f) => f.toUpperCase()).join(', ')}</code> · {t('fab.maxSize')}
          </span>
        </label>
      ) : (
        <div className="file-card">
          <div className="file-card__row">
            <span className="file-card__icon">
              <FontAwesomeIcon icon={service.key === 'impression-3d' ? faCloudArrowUp : faFileLines} />
            </span>
            <div className="file-card__info">
              <strong className="file-card__name">{file.name}</strong>
              <span className="muted small">{formatBytes(file.size)}</span>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onFile(null)} title={t('fab.remove')}>
              <FontAwesomeIcon icon={faTrash} />
              <span className="sr-only">{t('fab.remove')}</span>
            </button>
          </div>

          {analysis.status === 'loading' && <p className="muted small">{t('fab.analyzing')}</p>}
          {analysis.status === 'unsupported' && service.hasEstimator && <p className="muted small">{t('fab.noPreview')}</p>}
          {analysis.status === 'error' && (
            <p className="alert alert--error small">
              <FontAwesomeIcon icon={faCircleExclamation} /> {t('fab.analysisError')}
            </p>
          )}
          {analysis.status === 'done' && (
            <>
              <ModelViewer geometry={analysis.geometry} color={color} bbox={analysis.metrics.bbox} />
              <div className="metrics">
                <div className="metric">
                  <span className="metric__label">{t('fab.mesh')}</span>
                  <span className={`metric__value ${analysis.metrics.watertight ? 'is-ok' : 'is-warn'}`}>
                    <FontAwesomeIcon icon={analysis.metrics.watertight ? faCircleCheck : faCircleExclamation} />{' '}
                    {analysis.metrics.watertight ? t('fab.watertight') : t('fab.notWatertight')}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric__label">{t('fab.dimensions')}</span>
                  <span className="metric__value mono">
                    {analysis.metrics.bbox.x} × {analysis.metrics.bbox.y} × {analysis.metrics.bbox.z} mm
                  </span>
                </div>
                <div className="metric">
                  <span className="metric__label">{t('fab.volume')}</span>
                  <span className="metric__value mono">
                    {analysis.metrics.volume_cm3.toLocaleString()} cm³ · {analysis.metrics.triangles.toLocaleString()} {t('fab.triangles')}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function EstimatePanel({ service, tier, est, discountRate, submitting, onSubmit, error }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const flow = ['review', 'quote', 'production', 'pickup'];

  return (
    <div className="panel estimate">
      <header className="estimate__head">
        <span>
          <FontAwesomeIcon icon={faCalculator} /> {t('fab.estimate')}
        </span>
        <span className="badge">{t(`fab.tiers.${tier}`)}</span>
      </header>

      <div className="estimate__total">
        <span className="eyebrow">{t('fab.estimateTotal')}</span>
        {est ? (
          <div className="estimate__amount">
            <strong>{formatEUR(est.total, lang)}</strong>
            {est.discount > 0 && <s>{formatEUR(est.gross, lang)}</s>}
          </div>
        ) : (
          <>
            <strong className="estimate__amount estimate__amount--muted">{t('fab.onQuote')}</strong>
            <p className="muted small">{service.hasEstimator ? t('fab.uploadToEstimate') : t('fab.onQuoteHint')}</p>
          </>
        )}
      </div>

      {est && (
        <div className="breakdown">
          <div className="breakdown__row">
            <span>
              {t('fab.materialLine')} · {est.units.toLocaleString()} {est.unit}
            </span>
            <span>{formatEUR(est.material, lang)}</span>
          </div>
          <div className="breakdown__row">
            <span>{t('fab.setupLine')}</span>
            <span>{formatEUR(est.setup, lang)}</span>
          </div>
          <div className="breakdown__row">
            <span>{t('fab.checkLine')}</span>
            <span className="accent">{t('fab.free')}</span>
          </div>
          {est.discount > 0 && (
            <div className="breakdown__row breakdown__row--accent">
              <span>
                {t('fab.discountLine')} (−{Math.round(discountRate * 100)} %)
              </span>
              <span>−{formatEUR(est.discount, lang)}</span>
            </div>
          )}
        </div>
      )}

      <ol className="mini-flow">
        {flow.map((f, i) => (
          <li key={f} className={i === 0 ? 'is-active' : ''}>
            <span />
            {t(`fab.flow.${f}`)}
          </li>
        ))}
      </ol>

      {error && (
        <div className="alert alert--error small" role="alert">
          <FontAwesomeIcon icon={faCircleExclamation} /> {error}
        </div>
      )}

      <button type="button" className="btn btn--primary btn--block" disabled={submitting} onClick={onSubmit}>
        <FontAwesomeIcon icon={faPaperPlane} />
        {submitting ? t('fab.submitting') : t('fab.submit')}
      </button>
      <p className="muted tiny center">{est ? t('fab.indicative') : t('fab.afterSubmit')}</p>
    </div>
  );
}

function Success({ result, onReset }) {
  const { t } = useTranslation();
  const { to } = useLang();
  return (
    <Reveal className="panel success">
      <span className="success__icon">
        <FontAwesomeIcon icon={faCircleCheck} />
      </span>
      <h2 className="headline">{t('fab.successTitle')}</h2>
      <p className="lead">{t('fab.successText', { reference: result.reference })}</p>
      <div className="btn-row btn-row--center">
        <Link className="btn btn--primary" to={to(`/fabrication/suivi/${result.token}`)}>
          {t('fab.trackCta')}
        </Link>
        <button type="button" className="btn btn--ghost" onClick={onReset}>
          {t('fab.newRequest')}
        </button>
      </div>
    </Reveal>
  );
}

const emptyForm = {
  tier: 'etudiant',
  name: '',
  email: '',
  phone: '',
  organization: '',
  materialKey: null,
  color: null,
  infill: 25,
  layerHeight: '0.20',
  quantity: 1,
  deadline: '',
  notes: '',
  consentReview: false,
  consentData: false,
};

export default function Fabrication() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const [params, setParams] = useSearchParams();
  const catalog = useApi((signal) => api.fabrication.catalog(lang, { signal }), [lang]);

  const serviceKey = params.get('service') ?? 'impression-3d';
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState({ status: 'idle' });
  const [submit, setSubmit] = useState({ state: 'idle' });

  const data = catalog.data;
  const service = data?.services.find((s) => s.key === serviceKey) ?? data?.services[0];
  const materials = useMemo(() => data?.materials.filter((m) => m.service === service?.key) ?? [], [data, service]);
  const material = materials.find((m) => m.key === form.materialKey) ?? null;
  const discountRate = Number(data?.settings.discounts[form.tier] ?? 0);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Default material and colour whenever the service (or catalogue language) changes.
  useEffect(() => {
    if (!materials.length) return setForm((f) => ({ ...f, materialKey: null, color: null }));
    setForm((f) => {
      const keep = materials.find((m) => m.key === f.materialKey);
      const m = keep ?? materials[0];
      const color = m.colors.some((c) => c.key === f.color) ? f.color : (m.colors[0]?.key ?? null);
      return { ...f, materialKey: m.key, color };
    });
  }, [materials]);

  // Drop a file the newly selected service can't take.
  useEffect(() => {
    if (file && service && !service.formats.includes(file.name.split('.').pop().toLowerCase())) handleFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.key]);

  async function handleFile(f) {
    setSubmit({ state: 'idle' });
    if (!f) {
      setFile(null);
      setAnalysis({ status: 'idle' });
      return;
    }
    const ext = f.name.split('.').pop().toLowerCase();
    if (!service.formats.includes(ext)) {
      setSubmit({ state: 'error', message: `${t('fab.formats')} : ${service.formats.join(', ').toUpperCase()}` });
      return;
    }
    if (f.size > MAX_BYTES) {
      setSubmit({ state: 'error', message: `${f.name} > 50 MB` });
      return;
    }
    setFile(f);
    if (!service.hasEstimator || !PREVIEWABLE.includes(ext)) return setAnalysis({ status: 'unsupported' });
    setAnalysis({ status: 'loading' });
    try {
      const geometry = await loadGeometry(f);
      setAnalysis({ status: 'done', geometry, metrics: measure(geometry) });
    } catch (err) {
      console.error(err);
      setAnalysis({ status: 'error' });
    }
  }

  const est = useMemo(() => {
    if (!service?.hasEstimator || analysis.status !== 'done' || !material) return null;
    return estimate({
      volumeCm3: analysis.metrics.volume_cm3,
      material,
      infill: form.infill,
      quantity: form.quantity,
      setupFee: data.settings.setupFee,
      discountRate,
    });
  }, [service, analysis, material, form.infill, form.quantity, data, discountRate]);

  async function send() {
    const missing = [];
    if (!form.name.trim()) missing.push(t('form.name'));
    if (!/^\S+@\S+\.\S+$/.test(form.email)) missing.push(t('form.email'));
    if (FILE_REQUIRED.includes(service.key) && !file) missing.push(t('fab.steps.file'));
    if (!form.consentReview || !form.consentData) missing.push(t('fab.steps.context'));
    if (missing.length) return setSubmit({ state: 'error', message: t('fab.missing') + missing.join(', ') });

    const payload = {
      service_key: service.key,
      tier: form.tier,
      name: form.name,
      email: form.email,
      phone: form.phone,
      organization: form.organization,
      material_key: form.materialKey,
      color: form.color,
      infill: service.hasEstimator ? form.infill : null,
      layer_height: service.hasEstimator ? Number(form.layerHeight) : null,
      quantity: form.quantity,
      deadline: form.deadline || null,
      notes: form.notes,
      consent: true,
      locale: lang,
      analysis: analysis.status === 'done' ? analysis.metrics : null,
    };
    const body = new FormData();
    body.append('data', JSON.stringify(payload));
    if (file) body.append('file', file);

    setSubmit({ state: 'sending' });
    try {
      const result = await api.fabrication.submit(body);
      setSubmit({ state: 'done', result });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const details = err.body?.details ? Object.values(err.body.details).flat().join(' ') : '';
      setSubmit({
        state: 'error',
        message: err.status === 429 ? t('fab.tooMany') : `${t('fab.submitError')} ${details || err.message}`,
      });
    }
  }

  function reset() {
    setForm(emptyForm);
    handleFile(null);
    setSubmit({ state: 'idle' });
  }

  const colorHex = material?.colors.find((c) => c.key === form.color)?.hex;

  return (
    <>
      <PageHead eyebrow={t('fab.eyebrow')} title={t('fab.title')} lead={t('fab.lead')} />
      <section className="section section--alt fab">
        <div className="container container--wide">
          <LoadState {...catalog}>
            {data && service && (
              <>
                {submit.state === 'done' ? (
                  <Success result={submit.result} onReset={reset} />
                ) : (
                  <>
                    <h2 className="title fab__subtitle">{t('fab.pickService')}</h2>
                    <ServicePicker
                      services={data.services}
                      value={service.key}
                      onChange={(key) => setParams({ service: key }, { replace: true })}
                    />

                    <div className="fab-layout">
                      <div className="fab-layout__main">
                        <StepPanel n={1} title={t('fab.steps.identity')}>
                          <div className="field">
                            <label>{t('fab.tierLabel')}</label>
                            <div className="segmented segmented--3">
                              {TIERS.map((tier) => (
                                <button
                                  key={tier.key}
                                  type="button"
                                  aria-pressed={form.tier === tier.key}
                                  onClick={() => set('tier', tier.key)}
                                >
                                  <FontAwesomeIcon icon={tier.icon} />
                                  {t(`fab.tiers.${tier.key}`)}
                                  {data.settings.discounts[tier.key] > 0 && (
                                    <span className="badge">−{Math.round(data.settings.discounts[tier.key] * 100)} %</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="field">
                              <label htmlFor="fab-name">{t('form.name')} *</label>
                              <input id="fab-name" className="input" autoComplete="name" maxLength={120} value={form.name} onChange={(e) => set('name', e.target.value)} />
                            </div>
                            <div className="field">
                              <label htmlFor="fab-email">{t('form.email')} *</label>
                              <input id="fab-email" type="email" className="input" autoComplete="email" maxLength={254} value={form.email} onChange={(e) => set('email', e.target.value)} />
                            </div>
                            <div className="field">
                              <label htmlFor="fab-phone">{t('fab.phone')}</label>
                              <input id="fab-phone" type="tel" className="input" autoComplete="tel" maxLength={40} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                            </div>
                            <div className="field">
                              <label htmlFor="fab-org">{t('fab.organization')}</label>
                              <input id="fab-org" className="input" autoComplete="organization" maxLength={160} value={form.organization} onChange={(e) => set('organization', e.target.value)} />
                            </div>
                          </div>
                        </StepPanel>

                        <StepPanel n={2} title={t('fab.steps.file')}>
                          <FileStep service={service} file={file} analysis={analysis} color={colorHex} onFile={handleFile} />
                        </StepPanel>

                        <StepPanel n={3} title={t('fab.steps.params')}>
                          {materials.length > 0 && (
                            <div className="field">
                              <label>{t('fab.material')}</label>
                              <div className="choice-grid">
                                {materials.map((m) => (
                                  <button
                                    key={m.key}
                                    type="button"
                                    aria-pressed={form.materialKey === m.key}
                                    className="choice"
                                    onClick={() => set('materialKey', m.key)}
                                  >
                                    <strong>{m.name}</strong>
                                    <span className="muted small">{m.hint}</span>
                                    <span className="mono small">
                                      {formatEUR(m.price, lang)} / {m.unit}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {material?.colors.length > 0 && (
                            <div className="field">
                              <label>{t('fab.color')}</label>
                              <div className="swatches">
                                {material.colors.map((c) => (
                                  <button
                                    key={c.key}
                                    type="button"
                                    className="swatch"
                                    style={{ background: c.hex }}
                                    aria-pressed={form.color === c.key}
                                    title={c.name}
                                    onClick={() => set('color', c.key)}
                                  >
                                    <span className="sr-only">{c.name}</span>
                                  </button>
                                ))}
                                <span className="swatches__label">{material.colors.find((c) => c.key === form.color)?.name}</span>
                              </div>
                            </div>
                          )}

                          {service.hasEstimator && (
                            <div className="form-row">
                              <div className="field">
                                <label>
                                  {t('fab.infill')} · <span className="accent">{form.infill} %</span>
                                </label>
                                <div className="segmented segmented--4">
                                  {INFILLS.map((v) => (
                                    <button key={v} type="button" aria-pressed={form.infill === v} onClick={() => set('infill', v)}>
                                      {v} % <span className="muted tiny">{t(`fab.infillOptions.${v}`)}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="field">
                                <label htmlFor="fab-layer">{t('fab.layer')}</label>
                                <select id="fab-layer" className="input" value={form.layerHeight} onChange={(e) => set('layerHeight', e.target.value)}>
                                  {LAYERS.map((l) => (
                                    <option key={l} value={l}>
                                      {t(`fab.layerOptions.${l}`)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}

                          <div className="form-row">
                            <div className="field">
                              <label htmlFor="fab-qty">{t('fab.quantity')}</label>
                              <div className="stepper">
                                <button type="button" aria-label="−" onClick={() => set('quantity', Math.max(1, form.quantity - 1))}>
                                  <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <input
                                  id="fab-qty"
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={form.quantity}
                                  onChange={(e) => set('quantity', Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
                                />
                                <button type="button" aria-label="+" onClick={() => set('quantity', Math.min(500, form.quantity + 1))}>
                                  <FontAwesomeIcon icon={faPlus} />
                                </button>
                              </div>
                            </div>
                            <div className="field">
                              <label htmlFor="fab-deadline">{t('fab.deadline')}</label>
                              <input
                                id="fab-deadline"
                                type="date"
                                className="input"
                                min={new Date().toISOString().slice(0, 10)}
                                value={form.deadline}
                                onChange={(e) => set('deadline', e.target.value)}
                              />
                            </div>
                          </div>
                        </StepPanel>

                        <StepPanel n={4} title={t('fab.steps.context')}>
                          <div className="field">
                            <label htmlFor="fab-notes">{t('fab.notes')}</label>
                            <textarea
                              id="fab-notes"
                              className="input"
                              maxLength={5000}
                              placeholder={t('fab.notesPlaceholder')}
                              value={form.notes}
                              onChange={(e) => set('notes', e.target.value)}
                            />
                          </div>
                          <label className="check">
                            <input type="checkbox" checked={form.consentReview} onChange={(e) => set('consentReview', e.target.checked)} />
                            <span>{t('fab.consentReview')}</span>
                          </label>
                          <label className="check">
                            <input type="checkbox" checked={form.consentData} onChange={(e) => set('consentData', e.target.checked)} />
                            <span>{t('fab.consentData')}</span>
                          </label>
                        </StepPanel>
                      </div>

                      <aside className="fab-layout__side">
                        <EstimatePanel
                          service={service}
                          tier={form.tier}
                          est={est}
                          discountRate={discountRate}
                          submitting={submit.state === 'sending'}
                          onSubmit={send}
                          error={submit.state === 'error' ? submit.message : null}
                        />
                        <div className="panel panel--soft guarantee">
                          <strong>
                            <FontAwesomeIcon icon={faShieldHalved} /> {t('fab.guaranteeTitle')}
                          </strong>
                          <p className="muted small">{t('fab.guaranteeText')}</p>
                        </div>
                      </aside>
                    </div>
                  </>
                )}
              </>
            )}
          </LoadState>
        </div>
      </section>
    </>
  );
}
