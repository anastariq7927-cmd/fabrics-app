import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLang } from '../hooks/useLang';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import Icon from '../components/Icon';
import Reveal from '../components/Reveal';
import { ArrowLink, CTASection, LoadState, PageHead, PartnerStrip } from '../components/Blocks';

export default function Services() {
  const { t } = useTranslation();
  const { lang, to } = useLang();
  const { hash } = useLocation();
  const state = useApi((signal) => api.intentions(lang, { signal }), [lang]);

  // Anchors like /services#apprendre only exist once the data has rendered.
  useEffect(() => {
    if (state.data && hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [state.data, hash]);

  return (
    <>
      <PageHead eyebrow={t('services.eyebrow')} title={t('services.title')} lead={t('services.lead')} />
      <section className="container container--wide" style={{ paddingBottom: 'var(--section-y)' }}>
        <LoadState {...state}>
          {state.data?.map((it) => (
            <article key={it.key} id={it.key} className="service">
              <Reveal className="service__media">
                <img src={it.image} alt={it.caption ?? ''} loading="lazy" />
              </Reveal>
              <Reveal delay={120}>
                <span className="eyebrow">
                  {String(it.position).padStart(2, '0')} · <Icon name={it.icon} />
                </span>
                <h2 className="headline">{it.title}</h2>
                <p className="lead">{it.description}</p>
                <div className="service__audience">
                  <strong>{t('services.forWhom')}</strong>
                  {it.audience}
                </div>
                <p style={{ marginTop: 24 }}>
                  <ArrowLink to={to(`/rejoindre?intention=${it.key}#contact`)}>{t('services.joinWith')}</ArrowLink>
                </p>
              </Reveal>
            </article>
          ))}
        </LoadState>
      </section>
      <PartnerStrip />
      <CTASection />
    </>
  );
}
