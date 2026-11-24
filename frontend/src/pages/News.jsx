import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLang } from '../hooks/useLang';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import Reveal from '../components/Reveal';
import { CardSkeletons, CTASection, LoadState, NewsCard, PageHead } from '../components/Blocks';

const INTENT_KEYS = ['construire', 'apprendre', 'transmettre', 'rayonner'];

function FeaturedProject() {
  const { t } = useTranslation();
  const { lang, to } = useLang();
  const { data } = useApi((signal) => api.intentions(lang, { signal }), [lang]);

  return (
    <section className="section section--dark">
      <div className="container container--wide">
        <div className="split" style={{ alignItems: 'center' }}>
          <Reveal>
            <span className="eyebrow">{t('news.featured')}</span>
            <h2 className="display">CShell</h2>
            <p className="lead">{t('cshell.lead')}</p>
            <div className="btn-row">
              <Link to={to('/projets/cshell')} className="btn btn--light">
                {t('news.discover')}
              </Link>
              <Link to={to('/rejoindre#contact')} className="btn btn--ghost">
                {t('news.joinProject')}
              </Link>
            </div>
          </Reveal>
          <Reveal delay={120} className="service__media">
            <img src="/img/voitures.jpg" alt="CShell" loading="lazy" />
          </Reveal>
        </div>
        <div className="feature-grid" style={{ marginTop: 56 }}>
          {INTENT_KEYS.map((key, i) => (
            <Reveal key={key} className="feature" delay={i * 80}>
              <div className="feature__num">{String(i + 1).padStart(2, '0')}</div>
              <h3>
                {data?.find((d) => d.key === key)?.title ?? t(`form.intentions.${key}`)}
              </h3>
              <p>{data?.find((d) => d.key === key)?.caption}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function News() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const state = useApi((signal) => api.news(lang, 50, { signal }), [lang]);

  return (
    <>
      <PageHead eyebrow={t('news.eyebrow')} title={t('news.title')} lead={t('news.lead')} />
      <FeaturedProject />
      <section className="section section--alt">
        <div className="container container--wide">
          <Reveal className="section-head">
            <span className="eyebrow">{t('news.listEyebrow')}</span>
            <h2 className="headline">{t('news.listTitle')}</h2>
          </Reveal>
          <LoadState {...state} skeleton={<CardSkeletons />}>
            {state.data?.length ? (
              <div className="card-grid">
                {state.data.map((item, i) => (
                  <NewsCard key={item.id} item={item} delay={(i % 3) * 100} />
                ))}
              </div>
            ) : (
              <p className="state">{t('news.empty')}</p>
            )}
          </LoadState>
        </div>
      </section>
      <CTASection />
    </>
  );
}
