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

export interface Agenda {
  source: string;
  timezone: string;
  utcOffset: string;
  fetchedAt: string;
  rooms: string[];
  labels: string[];
  sessions: Session[];
}
