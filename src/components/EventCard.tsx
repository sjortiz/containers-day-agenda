import Link from 'next/link';
import type { Agenda } from '@/types';
import {
  eventDateSummary,
  eventSessionSummary,
  providerLabel,
} from '@/lib/event-summary';
import ShareEventButton from './ShareEventButton';

export default function EventCard({ agenda }: { agenda: Agenda }) {
  const { event } = agenda;
  const refreshLabel =
    event.refreshMode === 'live' ? 'Actualización automática' : 'Copia importada';

  return (
    <article className="event-card">
      <Link
        className="event-card__link"
        href={`/event/?id=${encodeURIComponent(event.id)}`}
      >
        <span className="event-card__eyebrow">
          {providerLabel(event.provider)}
        </span>
        <h2 className="event-card__title">{event.name}</h2>
        <span className="event-card__meta">
          {eventDateSummary(agenda)} · {eventSessionSummary(agenda)}
        </span>
        <span
          className={`event-card__refresh event-card__refresh--${event.refreshMode}`}
        >
          <span aria-hidden="true">●</span> {refreshLabel}
        </span>
      </Link>
      <div className="event-card__actions">
        <Link className="event-card__action" href={`/event/?id=${encodeURIComponent(event.id)}`}>
          Abrir agenda <span aria-hidden="true">→</span>
        </Link>
        {event.provider === 'sessionize' ? <ShareEventButton event={event} /> : null}
      </div>
    </article>
  );
}
