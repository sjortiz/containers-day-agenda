'use client';

import type { Session } from '@/types';
import { NOTIFY_LEAD_MINUTES } from '@/config';
import { describeCountdown, formatTime, toMs } from '@/lib/time';

interface Props {
  session: Session | null;
  tz: string;
  now: number;
}

export default function UpcomingBanner({ session, tz, now }: Props) {
  if (!session || !now) return null;
  const ms = toMs(session.start) - now;
  if (ms <= 0) return null;

  const soon = ms <= NOTIFY_LEAD_MINUTES * 60000;
  const speaker = session.speakers.length
    ? ` · ${session.speakers.join(', ')}`
    : '';

  return (
    <aside
      className={`banner${soon ? ' banner--soon' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="banner__label">
        {soon ? '¡Prepárate! Tu próxima charla' : 'Tu próxima charla'}
      </div>
      <div className="banner__title">{session.title}</div>
      <div className="banner__meta">
        🕒 {formatTime(session.start, tz)} · 📍 {session.room}
        {speaker}
      </div>
      <div className="banner__count">{describeCountdown(ms)}</div>
    </aside>
  );
}
