// Pieces shared by the public tracking page and the admin back office.
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faPaperPlane,
  faFileInvoice,
  faCreditCard,
  faGears,
  faBoxOpen,
} from '@fortawesome/free-solid-svg-icons';
import { formatEUR } from './pricing';

const RIBBON_ICONS = [faPaperPlane, faFileInvoice, faCreditCard, faGears, faBoxOpen];

// Position of each status on the 5-step ribbon (index of the current step).
const STEP_OF = {
  submitted: 0,
  in_review: 0,
  needs_info: 0,
  quoted: 2,
  paid: 3,
  in_production: 3,
  ready: 4,
  delivered: 5,
  rejected: -1,
};

export function StatusPill({ status }) {
  const { t } = useTranslation();
  return <span className={`status-pill status-pill--${status}`}>{t(`fab.status.${status}`)}</span>;
}

export function StatusRibbon({ status, events = [] }) {
  const { t, i18n } = useTranslation();
  const labels = t('fab.ribbon');
  const current = STEP_OF[status] ?? 0;
  // Date each step was reached, taken from the event log when available.
  const reachedAt = (type) => events.find((e) => e.type === type)?.created_at;
  const dates = [reachedAt('submitted'), reachedAt('quoted'), reachedAt('paid'), reachedAt('in_production'), reachedAt('ready')];

  return (
    <ol className="ribbon" aria-label="Progress">
      {labels.map((label, i) => {
        const state = status === 'rejected' ? 'todo' : i < current ? 'done' : i === current ? 'active' : 'todo';
        return (
          <li key={label} className={`ribbon__step ribbon__step--${state}`}>
            <span className="ribbon__dot">
              <FontAwesomeIcon icon={state === 'done' ? faCheck : RIBBON_ICONS[i]} />
            </span>
            <span className="ribbon__label">{label}</span>
            {dates[i] && state !== 'todo' && (
              <span className="ribbon__date">
                {new Date(dates[i]).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Timeline({ events, showActor = false }) {
  const { t, i18n } = useTranslation();
  if (!events?.length) return null;
  return (
    <ul className="timeline">
      {events.map((e) => (
        <li key={e.id ?? `${e.type}-${e.created_at}`} className={`timeline__item ${e.public === false ? 'timeline__item--internal' : ''}`}>
          <span className="timeline__dot" />
          <div>
            <div className="timeline__head">
              <strong>{t(`fab.status.${e.type}`)}</strong>
              <time dateTime={e.created_at}>
                {new Date(e.created_at).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
            </div>
            {e.message && <p className="timeline__msg">{e.message}</p>}
            {showActor && e.actor && <p className="timeline__actor">{e.actor}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function QuoteBreakdown({ quote }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <div className="breakdown">
      {quote.lines.map((l, i) => (
        <div key={i} className="breakdown__row">
          <span>{l.label}</span>
          <span>{formatEUR(l.amount, lang)}</span>
        </div>
      ))}
      {quote.discount > 0 && (
        <>
          <div className="breakdown__row breakdown__row--muted">
            <span>{t('fab.admin.gross')}</span>
            <s>{formatEUR(quote.gross, lang)}</s>
          </div>
          <div className="breakdown__row breakdown__row--accent">
            <span>
              {t('fab.discountLine')} (−{Math.round(quote.discount_rate * 100)} %)
            </span>
            <span>−{formatEUR(quote.discount, lang)}</span>
          </div>
        </>
      )}
      <div className="breakdown__total">
        <span>{t('fab.admin.total')}</span>
        <strong>{formatEUR(quote.total, lang)}</strong>
      </div>
    </div>
  );
}

export function SpecGrid({ items }) {
  return (
    <div className="spec-grid">
      {items
        .filter((it) => it.value !== null && it.value !== undefined && it.value !== '')
        .map((it) => (
          <div key={it.label} className="spec">
            <span className="spec__label">{it.label}</span>
            <span className="spec__value">{it.value}</span>
          </div>
        ))}
    </div>
  );
}
