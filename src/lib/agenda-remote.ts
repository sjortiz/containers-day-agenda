/**
 * Descarga en runtime del horario publicado. En un sitio estático la agenda se
 * hornea en build time, pero la organización a veces mueve las charlas durante
 * el evento. Para no quedarnos con datos viejos, al disparar cada aviso volvemos
 * a pedir el mismo JSON que produce el build (servido como asset estático) y, si
 * es más reciente, reemplazamos la copia guardada.
 */
import type { Agenda } from '@/types';
import { withBase } from '@/config';

/** Ruta estable del horario publicado (misma copia que src/data/agenda.json). */
const AGENDA_PATH = '/agenda.json';

/** Jitter para escalonar las peticiones: de 1s a 2min. */
const JITTER_MIN_MS = 1_000;
const JITTER_MAX_MS = 120_000;

/**
 * Retardo aleatorio (1s–2min) para que no todos los clientes pidan el horario
 * en el mismo instante y no se sature el origen.
 */
export function scheduleJitterMs(): number {
  return JITTER_MIN_MS + Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS);
}

/** ¿`next` es una versión más reciente de la agenda que `current`? */
export function isNewerAgenda(next: Agenda, current: Agenda): boolean {
  const a = Date.parse(next.fetchedAt);
  const b = Date.parse(current.fetchedAt);
  if (Number.isNaN(a)) return false; // sin marca válida: no lo tomamos como nuevo
  if (Number.isNaN(b)) return true;
  return a > b;
}

function looksLikeAgenda(data: unknown): data is Agenda {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as Agenda).sessions) &&
    typeof (data as Agenda).timezone === 'string' &&
    typeof (data as Agenda).fetchedAt === 'string'
  );
}

/**
 * Descarga el horario publicado. Devuelve null ante cualquier error (offline,
 * 404, JSON inválido) para que un fallo nunca rompa los avisos ya programados.
 */
export async function fetchPublishedAgenda(): Promise<Agenda | null> {
  try {
    const res = await fetch(withBase(AGENDA_PATH), { cache: 'no-store' });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return looksLikeAgenda(data) ? data : null;
  } catch {
    return null;
  }
}
