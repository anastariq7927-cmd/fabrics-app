import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../hooks/useLang';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import Icon from '../components/Icon';
import Reveal from '../components/Reveal';
import { ArrowLink, CardSkeletons, CTASection, LoadState, NewsCard, PartnerStrip } from '../components/Blocks';

// three.js is only downloaded when the 3D assembly is actually shown.
const CarScene = lazy(() => import('../components/CarScene'));

function Hero() {
  const { t } = useTranslation();
  const { to } = useLang();
  return (
    <section className="intro">
      <div className="container container--wide intro__grid">
        <Reveal>
          <span className="eyebrow">{t('home.eyebrow')}</span>
          <h1 className="display">{t('home.title')}</h1>
          <p className="lead">{t('home.lead')}</p>
          <div className="btn-row">
            <Link to={to('/services')} className="btn btn--primary">
              {t('home.ctaServices')}
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
            <Link to={to('/actualites')} className="btn btn--ghost">
              {t('home.ctaNews')}
            </Link>
          </div>
        </Reveal>
        <Reveal as="figure" className="intro__figure" delay={120}>
          <img src="/img/campus_metz.jpg" alt="" fetchPriority="high" />
          <figcaption>
            <span>Metz — Technopôle</span>
            <span>49.10° N · 6.22° E</span>
          </figcaption>
        </Reveal>
      </div>
    </section>
  );
}

// The 3D assembly needs WebGL and a visitor who hasn't asked for reduced motion.
function canAnimate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// The CShell prototype comes apart step by step while the four intentions scroll past.
function Assembly({ items }) {
  const { t } = useTranslation();
  const { to } = useLang();
  const ref = useRef(null);
  const progressRef = useRef(0);
  const [active, setActive] = useState(0);
  const labels = t('home.carParts', { returnObjects: true });

  useEffect(() => {
    const update = () => {
      const node = ref.current;
      if (!node) return;
      const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;
      const { top, height } = node.getBoundingClientRect();
      const travel = Math.max(1, height - (window.innerHeight - navH));
      const p = Math.min(1, Math.max(0, (navH - top) / travel));
      progressRef.current = p;
      setActive(Math.min(items.length - 1, Math.floor(p * items.length)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [items.length]);

  return (
    <div className="assembly" ref={ref}>
      <div className="assembly__stage">
        <Suspense fallback={null}>
          <CarScene progressRef={progressRef} labels={typeof labels === 'object' ? labels : {}} />
        </Suspense>
        <div className="assembly__hud" aria-hidden="true">
          <span>CShell · Shell Eco-marathon</span>
          <span>
            {String(active + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
        </div>
        <div className="assembly__progress" aria-hidden="true">
          {items.map((it, i) => (
            <span key={it.key} className={i <= active ? 'is-done' : ''} />
          ))}
        </div>
      </div>
      <ol className="assembly__steps">
        {items.map((it, i) => (
          <li key={it.key} className={`assembly__step ${i === active ? 'is-active' : ''}`}>
            <div>
              <span className="index__num">{String(it.position).padStart(2, '0')}</span>
              <h3 className="title assembly__title">
                {it.title}
                <Icon name={it.icon} />
              </h3>
              <p className="index__text">{it.summary}</p>
              <p style={{ marginTop: 24 }}>
                <ArrowLink to={to(`/services#${it.key}`)}>{t('common.learnMore')}</ArrowLink>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Intentions() {
  const { t } = useTranslation();
  const { lang, to } = useLang();
  const state = useApi((signal) => api.intentions(lang, { signal }), [lang]);
  const [animated] = useState(canAnimate);

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container container--wide">
        <Reveal className="section-head">
          <span className="eyebrow">{t('home.intentsEyebrow')}</span>
          <h2 className="headline">{t('home.intentsTitle')}</h2>
        </Reveal>
        <LoadState {...state} skeleton={<div className="skeleton" style={{ height: 520 }} />}>
          {animated && state.data?.length ? (
            <Assembly items={state.data} />
          ) : (
          <ol className="index">
            {state.data?.map((it, i) => (
              <Reveal as="li" key={it.key} delay={i * 60}>
                <Link to={to(`/services#${it.key}`)} className="index__row">
                  <span className="index__num">{String(it.position).padStart(2, '0')}</span>
                  <h3 className="index__title">
                    {it.title}
                    <Icon name={it.icon} />
                  </h3>
                  <p className="index__text">{it.summary}</p>
                  <div className="index__media">
                    <img src={it.image} alt={it.caption ?? ''} loading="lazy" />
                  </div>
                </Link>
              </Reveal>
            ))}
          </ol>
          )}
        </LoadState>
      </div>
    </section>
  );
}

function ProjectShowcase() {
  const { t } = useTranslation();
  const { lang, to } = useLang();
  const { data } = useApi((signal) => api.project('cshell', lang, { signal }), [lang]);

  return (
    <section className="showcase">
      <div className="container container--wide showcase__grid">
        <Reveal>
          <span className="eyebrow">{t('home.projectEyebrow')}</span>
          <h2 className="display">CShell</h2>
          {data && <p className="lead">{data.summary}</p>}
          <div className="btn-row">
            <Link to={to('/projets/cshell')} className="btn btn--light">
              {t('home.projectCta')}
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          </div>
        </Reveal>
        <Reveal className="showcase__media" delay={120}>
          <img src="/img/cshell-bg.jpg" alt="CShell" loading="lazy" />
        </Reveal>
      </div>
    </section>
  );
}

function LatestNews() {
  const { t } = useTranslation();
  const { lang, to } = useLang();
  const state = useApi((signal) => api.news(lang, 3, { signal }), [lang]);

  return (
    <section className="section">
      <div className="container container--wide">
        <Reveal className="section-head">
          <span className="eyebrow">{t('home.newsEyebrow')}</span>
          <h2 className="headline">{t('home.newsTitle')}</h2>
          <div className="section-head__action">
            <ArrowLink to={to('/actualites')}>{t('home.newsAll')}</ArrowLink>
          </div>
        </Reveal>
        <LoadState {...state} skeleton={<CardSkeletons />}>
          <div className="card-grid">
            {state.data?.map((item, i) => (
              <NewsCard key={item.id} item={item} delay={i * 80} />
            ))}
          </div>
        </LoadState>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Intentions />
      <ProjectShowcase />
      <LatestNews />
      <PartnerStrip />
      <CTASection />
    </>
  );
}
