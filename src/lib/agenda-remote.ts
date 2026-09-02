import type { Agenda } from '@/types';

/** ¿`next` es una versión más reciente de la agenda que `current`? */
export function isNewerAgenda(next: Agenda, current: Agenda): boolean {
  const a = Date.parse(next.fetchedAt);
  const b = Date.parse(current.fetchedAt);
  if (Number.isNaN(a)) return false; // sin marca válida: no lo tomamos como nuevo
  if (Number.isNaN(b)) return true;
  return a > b;
}

/** Motivo por el que no se pudo obtener (o confiar en) el horario publicado. */
export type AgendaFetchFailureReason = 'aborted' | 'network' | 'http' | 'invalid';

export type AgendaFetchResult =
  | { ok: true; agenda: Agenda }
  | {
      ok: false;
      reason: AgendaFetchFailureReason;
      /** Código de estado HTTP cuando `reason === 'http'`. */
      status?: number;
      /** Error original cuando `reason === 'network'`, útil para depurar. */
      error?: unknown;
    };
