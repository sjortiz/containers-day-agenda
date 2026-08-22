'use client';

import type { Session } from '@/types';
import { formatTimeRange, toMs } from '@/lib/time';
import { NOTIFY_LEAD_MINUTES } from '@/config';

interface Props {
  session: Session;
  tz: string;
  selected: boolean;
  onToggle: (id: string) => void;
  now: number;
}

function statusOf(session: Session, now: number): 'live' | 'soon' | null {
  if (!now) return null;
  const start = toMs(session.start);
  const end = session.end ? toMs(session.end) : start + 30 * 60000;
  if (now >= start && now < end) return 'live';
  if (now >= start - NOTIFY_LEAD_MINUTES * 60000 && now < start) return 'soon';
  return null;
}

export default function SessionCard({
  session,
  tz,
  selected,
  onToggle,
  now,
}: Props) {
  const status = statusOf(session, now);
  const canSelect = !session.isService;

  return (
    <article
      className={`card${selected ? ' card--selected' : ''}${
        status ? ` card--${status}` : ''
      }`}
    >
      <div className="card__head">
        <span className="card__time">
          {formatTimeRange(session.start, session.end, tz)}
        </span>
        <span className="card__room">{session.room}</span>
        {status === 'live' && <span className="badge badge--live">En curso</span>}
        {status === 'soon' && <span className="badge badge--soon">Pronto</span>}
      </div>

      <h3 className="card__title">{session.title}</h3>

      {session.speakers.length > 0 && (
        <p className="card__speakers">{session.speakers.join(', ')}</p>
      )}

      {session.labels.length > 0 && (
        <ul className="card__labels">
          {session.labels.map((l) => (
            <li key={l} className="tag">
              {l}
            </li>
          ))}
        </ul>
      )}

      {canSelect && (
        <label className="card__toggle">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(session.id)}
          />
          <span>{selected ? '★ En mi agenda' : '☆ Agregar a mi agenda'}</span>
        </label>
      )}
    </article>
  );
}
