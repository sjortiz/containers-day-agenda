export interface Session {
  /** ID estable provisto por containers.day (data-session). */
  id: string;
  title: string;
  room: string;
  speakers: string[];
  labels: string[];
  /** true para registro, coffee breaks y ceremonias (no son charlas). */
  isService: boolean;
  /** ISO 8601 con offset del evento, ej. "2026-08-22T09:00:00-04:00". */
  start: string;
  /** ISO 8601 con offset, o null si no hay fin declarado. */
  end: string | null;
}

/**
 * Identidad de un evento. Ver docs/specs/multi-event-home.md: es la unidad de
 * scope para toda la persistencia (`talk-track:<event-id>:...`) y, en Fase 2,
 * de la ruta `/event/?id=<event-id>`. `id` debe validar con
 * `isValidEventId` (ver lib/event-id.ts).
 */
export interface EventMeta {
  id: string;
  name: string;
  sourceUrl: string;
  timezone: string;
  provider: 'containers-day' | 'sessionize' | 'pretalx' | 'ics' | 'json';
  refreshMode: 'live' | 'manual';
  addedAt: string;
}

export interface Agenda {
  event: EventMeta;
  utcOffset: string;
  fetchedAt: string;
  rooms: string[];
  labels: string[];
  sessions: Session[];
}
