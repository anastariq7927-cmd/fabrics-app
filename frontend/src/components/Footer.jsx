import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLinkedinIn, faInstagram } from '@fortawesome/free-brands-svg-icons';
import { faHandHoldingHeart } from '@fortawesome/free-solid-svg-icons';
import { useLang } from '../hooks/useLang';

export const SOCIAL = {
  linkedin: 'https://www.linkedin.com/company/fabricsmetz',
  instagram: 'https://www.instagram.com/fabrics.metz',
  helloasso: 'https://www.helloasso.com/associations/fabrics-metz/adhesions/cotisation',
};

export default function Footer() {
  const { t } = useTranslation();
  const { to } = useLang();

  return (
    <footer className="footer">
      <div className="container container--wide">
        <div className="footer__grid">
          <div className="footer__about">
            <div className="footer__brand">
              <img src="/img/emblem.png" alt="" />
              FabriCS
            </div>
            <p>{t('footer.tagline')}</p>
            <p>Metz — Technopôle, France</p>
            <div className="footer__social">
              <a href={SOCIAL.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <FontAwesomeIcon icon={faLinkedinIn} />
              </a>
              <a href={SOCIAL.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                <FontAwesomeIcon icon={faInstagram} />
              </a>
              <a href={SOCIAL.helloasso} target="_blank" rel="noreferrer" aria-label="HelloAsso">
                <FontAwesomeIcon icon={faHandHoldingHeart} />
              </a>
            </div>
          </div>
          <div>
            <h4>{t('footer.explore')}</h4>
            <ul>
              <li><Link to={to('/services')}>{t('nav.services')}</Link></li>
              <li><Link to={to('/actualites')}>{t('nav.news')}</Link></li>
              <li><Link to={to('/projets/cshell')}>{t('nav.cshell')}</Link></li>
              <li><Link to={to('/fabrication')}>{t('nav.fabrication')}</Link></li>
              <li><Link to={to('/rejoindre')}>{t('nav.join')}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{t('footer.follow')}</h4>
            <ul>
              <li><a href={SOCIAL.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></li>
              <li><a href={SOCIAL.instagram} target="_blank" rel="noreferrer">Instagram</a></li>
              <li><a href={SOCIAL.helloasso} target="_blank" rel="noreferrer">HelloAsso</a></li>
            </ul>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} FabriCS. {t('footer.rights')}</span>
          <Link to="/admin">{t('footer.admin')}</Link>
        </div>
      </div>
    </footer>
  );
}
