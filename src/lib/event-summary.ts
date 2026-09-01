import type { Agenda, EventMeta } from '@/types';

const PROVIDER_LABELS: Record<EventMeta['provider'], string> = {
  'containers-day': 'Containers Day',
  sessionize: 'Sessionize',
  pretalx: 'Pretalx',
  ics: 'Calendario ICS',
  json: 'Agenda JSON',
};

export function providerLabel(provider: EventMeta['provider']): string {
  return PROVIDER_LABELS[provider];
}

export function eventDateSummary(agenda: Agenda, locale = 'es'): string {
  if (agenda.sessions.length === 0) return 'Sin sesiones';

  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const session of agenda.sessions) {
    const start = Date.parse(session.start);
    if (start < first) first = start;
    const end = session.end ? Date.parse(session.end) : start;
    if (end > last) last = end;
  }

  const format = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: agenda.event.timezone,
  });
  const firstLabel = format.format(first);
  const lastLabel = format.format(last);
  return firstLabel === lastLabel ? firstLabel : `${firstLabel} – ${lastLabel}`;
}

export function eventSessionSummary(agenda: Agenda): string {
  const count = agenda.sessions.length;
  return `${count} ${count === 1 ? 'sesión' : 'sesiones'}`;
}
