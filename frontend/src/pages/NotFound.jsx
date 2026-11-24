import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLang } from '../hooks/useLang';

export default function NotFound() {
  const { t } = useTranslation();
  const { to } = useLang();
  return (
    <section className="page-head">
      <div className="container">
        <span className="eyebrow">404</span>
        <h1 className="display">{t('notFound.title')}</h1>
        <div className="btn-row">
          <Link to={to('')} className="btn btn--primary">
            {t('notFound.back')}
          </Link>
        </div>
      </div>
    </section>
  );
}
