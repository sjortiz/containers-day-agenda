/**
 * Descarga en runtime del horario publicado. En un sitio estático la agenda se
 * hornea en build time, pero la organización a veces mueve las charlas durante
 * el evento. Para no quedarnos con datos viejos, `useAgendaRefresh` vuelve a
 * pedir el mismo JSON que produce el build (servido como asset estático) y, si
 * es más reciente, reemplaza la copia guardada.
 */
import type { Agenda } from '@/types';
import { withBase } from '@/config';
import { looksLikeAgenda } from './agenda-validation';

/** Ruta estable del horario publicado (misma copia que src/data/agenda.json). */
const AGENDA_PATH = '/agenda.json';

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

/**
 * Descarga el horario publicado. A diferencia de una versión que colapsara
 * todo a `null`, expone el motivo del fallo (red, HTTP, payload inválido o
 * abortada) para que quien la llama pueda distinguir esos casos: quien invoca
 * esta función decide cómo reaccionar (reintentos, UI de estado, etc.), esta
 * función solo reporta con precisión qué pasó.
 *
 * Acepta una `AbortSignal` opcional para que el llamador pueda cancelar la
 * petición (desmontaje del componente, timeout, o una petición que la
 * supera).
 */
export async function fetchPublishedAgenda(
  signal?: AbortSignal,
): Promise<AgendaFetchResult> {
  let res: Response;
  try {
    res = await fetch(withBase(AGENDA_PATH), { cache: 'no-store', signal });
  } catch (error) {
    if (signal?.aborted) return { ok: false, reason: 'aborted' };
    return { ok: false, reason: 'network', error };
  }
  if (!res.ok) return { ok: false, reason: 'http', status: res.status };

  let data: unknown;
  try {
    data = await res.json();
  } catch (error) {
    return { ok: false, reason: 'invalid', error };
  }
  return looksLikeAgenda(data)
    ? { ok: true, agenda: data }
    : { ok: false, reason: 'invalid' };
}
