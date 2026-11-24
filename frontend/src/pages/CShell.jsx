import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLang } from '../hooks/useLang';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import Icon from '../components/Icon';
import Reveal from '../components/Reveal';
import { LoadState, PartnerStrip } from '../components/Blocks';

export default function CShell() {
  const { t } = useTranslation();
  const { lang, to } = useLang();
  const state = useApi((signal) => api.project('cshell', lang, { signal }), [lang]);
  const project = state.data;

  return (
    <>
      <section className="hero hero--compact">
        <div className="hero__media">
          <img src="/img/circuit.jpg" alt="" fetchPriority="high" />
        </div>
        <div className="container container--wide hero__content">
          <Reveal>
            <span className="eyebrow">{t('cshell.eyebrow')}</span>
            <h1 className="display">
              CShell<span className="gradient-text">.</span>
            </h1>
            <p className="lead">{project?.tagline ?? ''} {t('cshell.lead')}</p>
          </Reveal>
        </div>
      </section>

      <LoadState {...state}>
        {project && (
          <>
            <section className="section">
              <div className="container container--wide">
                <Reveal className="section-head">
                  <span className="eyebrow">{t('cshell.aboutEyebrow')}</span>
                  <h2 className="headline">{t('cshell.aboutTitle')}</h2>
                  <p className="lead">{project.summary}</p>
                </Reveal>
                <div className="feature-grid">
                  {project.pillars.map((p, i) => (
                    <Reveal key={p.title} className="feature" delay={i * 100}>
                      <div className="feature__icon">
                        <Icon name={p.icon} />
                      </div>
                      <h3>{p.title}</h3>
                      <p>{p.text}</p>
                    </Reveal>
                  ))}
                </div>
              </div>
            </section>

            <section className="showcase showcase--bleed">
              <div className="showcase__media">
                <img src="/img/prototype.jpg" alt="CShell" loading="lazy" />
              </div>
            </section>

            <section className="section section--dark">
              <div className="container container--wide">
                <Reveal className="section-head">
                  <span className="eyebrow">{t('cshell.roadmapEyebrow')}</span>
                  <h2 className="headline">{t('cshell.roadmapTitle')}</h2>
                </Reveal>
                <div className="feature-grid">
                  {project.objectives.map((o, i) => (
                    <Reveal key={o.title} className="feature" delay={i * 80}>
                      <div className="feature__num">{String(i + 1).padStart(2, '0')}</div>
                      <h3>{o.title}</h3>
                      <p>{o.text}</p>
                    </Reveal>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </LoadState>

      <section className="hero hero--compact">
        <div className="hero__media">
          <img src="/img/voitures.jpg" alt="" loading="lazy" />
        </div>
        <Reveal className="container container--wide hero__content">
          <span className="eyebrow">{t('cshell.involveEyebrow')}</span>
          <h2 className="headline">{t('cshell.involveTitle')}</h2>
          <p className="lead">
            {t('cshell.involveText')}
          </p>
          <div className="btn-row">
            <Link to={to('/rejoindre#contact')} className="btn btn--light">
              {t('cshell.involveCta')}
            </Link>
          </div>
        </Reveal>
      </section>
      <PartnerStrip />
    </>
  );
}
