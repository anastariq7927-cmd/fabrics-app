// Small presentational building blocks shared across pages.
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { faLinkedinIn } from '@fortawesome/free-brands-svg-icons';
import { faNewspaper } from '@fortawesome/free-regular-svg-icons';
import { useLang, formatDate } from '../hooks/useLang';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import Reveal from './Reveal';

export function PageHead({ eyebrow, title, lead }) {
  return (
    <section className="page-head">
      <div className="container">
        <Reveal>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="display">{title}</h1>
          {lead && <p className="lead">{lead}</p>}
        </Reveal>
      </div>
    </section>
  );
}

export function LoadState({ loading, error, retry, skeleton = null, children }) {
  const { t } = useTranslation();
  if (loading) return skeleton ?? <p className="state">{t('common.loading')}</p>;
  if (error)
    return (
      <div className="state">
        <p>{t('common.error')}</p>
        <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 16 }} onClick={retry}>
          {t('common.retry')}
        </button>
      </div>
    );
  return children;
}

export function CardSkeletons({ count = 3 }) {
  return (
    <div className="card-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 420 }} />
      ))}
    </div>
  );
}

export function ArrowLink({ to, href, children }) {
  const content = (
    <>
      {children}
      <FontAwesomeIcon icon={href ? faArrowUpRightFromSquare : faArrowRight} />
    </>
  );
  return href ? (
    <a className="link-arrow" href={href} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    <Link className="link-arrow" to={to}>
      {content}
    </Link>
  );
}

const SOURCE_ICON = { linkedin: faLinkedinIn, press: faNewspaper };

export function NewsCard({ item, delay = 0 }) {
  const { t } = useTranslation();
  const { lang, to } = useLang();
  return (
    <Reveal as="article" className="card" delay={delay}>
      {item.image && (
        <div className="card__media">
          <img src={item.image} alt="" loading="lazy" />
        </div>
      )}
      <div className="card__body">
        <div className="card__meta">
          <time dateTime={item.date}>{formatDate(item.date, lang)}</time>
          <span className="badge">
            {SOURCE_ICON[item.source] && <FontAwesomeIcon icon={SOURCE_ICON[item.source]} />}
            {t(`news.sources.${item.source}`)}
          </span>
        </div>
        <h3 className="card__title">{item.title}</h3>
        <p className="card__text">{item.summary}</p>
        <div className="card__footer">
          {item.url ? (
            <ArrowLink href={item.url}>{item.source === 'press' ? t('news.readArticle') : t('news.readPost')}</ArrowLink>
          ) : (
            <ArrowLink to={to(`/actualites/${item.slug}`)}>{t('common.learnMore')}</ArrowLink>
          )}
        </div>
      </div>
    </Reveal>
  );
}

export function PartnerStrip() {
  const { t } = useTranslation();
  const { data } = useApi((signal) => api.partners({ signal }), []);
  if (!data?.length) return null;
  return (
    <section className="section">
      <div className="container container--wide">
        <Reveal className="section-head">
          <h2 className="title">{t('home.partnersTitle')}</h2>
        </Reveal>
        <Reveal className="partners" delay={100}>
          {data.map((p) => (
            <a key={p.name} href={p.url} target="_blank" rel="noreferrer" title={p.name}>
              <img src={p.logo} alt={p.name} loading="lazy" />
            </a>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

export function CTASection() {
  const { t } = useTranslation();
  const { to } = useLang();
  return (
    <section className="section cta">
      <Reveal className="container container--wide cta__inner">
        <h2 className="headline">{t('cta.question')}</h2>
        <div className="btn-row">
          <Link to={to('/rejoindre#contact')} className="btn btn--light">
            {t('cta.button')}
            <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
