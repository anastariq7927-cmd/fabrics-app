import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLang, formatDate } from '../hooks/useLang';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import Reveal from '../components/Reveal';
import { ArrowLink, CTASection, LoadState } from '../components/Blocks';

export default function NewsDetail() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const { lang, to } = useLang();
  const state = useApi((signal) => api.newsItem(slug, lang, { signal }), [slug, lang]);
  const item = state.data;

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="article">
            <ArrowLink to={to('/actualites')}>{t('news.back')}</ArrowLink>
            {state.error?.status === 404 ? (
              <p className="state">{t('news.notFound')}</p>
            ) : (
              <LoadState {...state}>
                {item && (
                  <Reveal>
                    <p className="card__meta" style={{ marginTop: 40 }}>
                      <time dateTime={item.date}>{formatDate(item.date, lang)}</time>
                      <span className="badge">{t(`news.sources.${item.source}`)}</span>
                    </p>
                    <h1 className="headline" style={{ marginTop: 16 }}>
                      {item.title}
                    </h1>
                    {item.image && (
                      <div className="article__media">
                        <img src={item.image} alt="" />
                      </div>
                    )}
                    <p className="lead">{item.summary}</p>
                    {item.body && <div className="article__body" style={{ marginTop: 32 }}>{item.body}</div>}
                    {item.url && (
                      <p style={{ marginTop: 32 }}>
                        <ArrowLink href={item.url}>{t('news.readPost')}</ArrowLink>
                      </p>
                    )}
                  </Reveal>
                )}
              </LoadState>
            )}
          </div>
        </div>
      </section>
      <CTASection />
    </>
  );
}
