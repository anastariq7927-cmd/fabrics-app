import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleExclamation,
  faHandHoldingHeart,
  faPaperPlane,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../hooks/useLang';
import { api } from '../api/client';
import Reveal from '../components/Reveal';
import { PageHead } from '../components/Blocks';
import { SOCIAL } from '../components/Footer';

const INTENTIONS = ['construire', 'apprendre', 'transmettre', 'rayonner', 'autre'];

function ContactForm() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const [params] = useSearchParams();
  const preset = params.get('intention');
  const empty = { name: '', email: '', intention: INTENTIONS.includes(preset) ? preset : 'construire', message: '', website: '' };
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState({ state: 'idle' });

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (form.message.trim().length < 10) {
      return setStatus({ state: 'error', message: t('form.messageTooShort') });
    }
    setStatus({ state: 'sending' });
    try {
      await api.sendMessage({ ...form, locale: lang });
      setForm(empty);
      setStatus({ state: 'success' });
    } catch (err) {
      setStatus({ state: 'error', message: err.status === 429 ? t('form.rateLimited') : t('form.error') });
    }
  }

  const sending = status.state === 'sending';

  return (
    <form className="form" onSubmit={submit} noValidate={false}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="name">{t('form.name')}</label>
          <input id="name" name="name" className="input" required maxLength={120} autoComplete="name" value={form.name} onChange={update} />
        </div>
        <div className="field">
          <label htmlFor="email">{t('form.email')}</label>
          <input id="email" name="email" type="email" className="input" required maxLength={254} autoComplete="email" value={form.email} onChange={update} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="intention">{t('form.intention')}</label>
        <select id="intention" name="intention" className="input" value={form.intention} onChange={update}>
          {INTENTIONS.map((key) => (
            <option key={key} value={key}>
              {t(`form.intentions.${key}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="message">{t('form.message')}</label>
        <textarea
          id="message"
          name="message"
          className="input"
          required
          minLength={10}
          maxLength={5000}
          placeholder={t('form.messagePlaceholder')}
          value={form.message}
          onChange={update}
        />
      </div>
      {/* Honeypot for bots */}
      <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={update} />

      {status.state === 'success' && (
        <div className="alert alert--success" role="status">
          <FontAwesomeIcon icon={faCircleCheck} style={{ marginTop: 3 }} />
          {t('form.success')}
        </div>
      )}
      {status.state === 'error' && (
        <div className="alert alert--error" role="alert">
          <FontAwesomeIcon icon={faCircleExclamation} style={{ marginTop: 3 }} />
          {status.message}
        </div>
      )}

      <div>
        <button type="submit" className="btn btn--primary" disabled={sending}>
          <FontAwesomeIcon icon={faPaperPlane} />
          {sending ? t('form.sending') : t('form.submit')}
        </button>
      </div>
    </form>
  );
}

export default function Join() {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const benefits = t('join.benefits');

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <>
      <PageHead eyebrow={t('join.eyebrow')} title={t('join.title')} lead={t('join.lead')} />

      <section className="section section--alt">
        <div className="container container--wide">
          <div className="split">
            <Reveal className="panel">
              <span className="eyebrow">{t('join.membershipEyebrow')}</span>
              <h2 className="headline">{t('join.membershipTitle')}</h2>
              <p className="lead">{t('join.membershipText')}</p>
              <div className="btn-row">
                <a href={SOCIAL.helloasso} target="_blank" rel="noreferrer" className="btn btn--primary">
                  <FontAwesomeIcon icon={faHandHoldingHeart} />
                  {t('join.membershipCta')}
                </a>
              </div>
            </Reveal>
            <Reveal className="panel" delay={120}>
              <h3 className="title">{t('join.benefitsTitle')}</h3>
              <ul className="check-list">
                {Array.isArray(benefits) &&
                  benefits.map((b) => (
                    <li key={b}>
                      <FontAwesomeIcon icon={faCheck} />
                      <span>{b}</span>
                    </li>
                  ))}
              </ul>
              <img src="/img/ecosysteme.jpg" alt="" loading="lazy" style={{ marginTop: 28, borderRadius: 'var(--radius)', aspectRatio: '16/10', objectFit: 'cover', width: '100%' }} />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="container">
          <Reveal className="section-head">
            <span className="eyebrow">{t('join.contactEyebrow')}</span>
            <h2 className="headline">{t('join.contactTitle')}</h2>
          </Reveal>
          <Reveal className="panel" delay={100}>
            <ContactForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
