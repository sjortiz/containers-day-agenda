/**
 * Validador compartido de `Agenda`. Antes existían dos versiones sueltas de
 * `looksLikeAgenda` (una en `agenda-remote.ts`, otra en `storage.ts`) que solo
 * chequeaban `sessions`/`timezone`/`fetchedAt`. Como el horario remoto y el
 * cacheado en localStorage son ambos datos no confiables (el primero viene de
 * la red, el segundo puede haber sido escrito por una versión vieja de la
 * app o corrompido a mano), los dos casos necesitan la misma validación
 * estricta: rechazar sin lanzar, para que quien llama pueda quedarse con la
 * última copia válida en vez de romper el render o los avisos.
 */
import type { Agenda, Session } from '@/types';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** ¿`iso` es un string que `Date.parse` puede interpretar como instante válido? */
function isParseableDate(iso: string): boolean {
  return !Number.isNaN(Date.parse(iso));
}

function looksLikeSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Session;
  if (!isNonEmptyString(s.id)) return false;
  if (!isNonEmptyString(s.title)) return false;
  if (!isNonEmptyString(s.room)) return false;
  if (!isStringArray(s.speakers)) return false;
  if (!isStringArray(s.labels)) return false;
  if (typeof s.isService !== 'boolean') return false;
  if (!isNonEmptyString(s.start) || !isParseableDate(s.start)) return false;
  if (s.end !== null) {
    if (!isNonEmptyString(s.end) || !isParseableDate(s.end)) return false;
    if (Date.parse(s.end) <= Date.parse(s.start)) return false;
  }
  return true;
}

/**
 * Type guard estricto: valida cada campo de `Agenda` y de cada `Session`
 * (ver `src/types.ts`), incluyendo IDs de sesión únicos y no vacíos. No
 * lanza: cualquier forma inesperada simplemente devuelve `false`, para que el
 * llamador descarte el dato y conserve la última agenda válida conocida.
 */
export function looksLikeAgenda(data: unknown): data is Agenda {
  if (typeof data !== 'object' || data === null) return false;
  const a = data as Agenda;

  if (!isNonEmptyString(a.source)) return false;
  if (!isNonEmptyString(a.timezone)) return false;
  if (!isNonEmptyString(a.utcOffset)) return false;
  if (!isNonEmptyString(a.fetchedAt) || !isParseableDate(a.fetchedAt)) return false;
  if (!isStringArray(a.rooms)) return false;
  if (!isStringArray(a.labels)) return false;
  if (!Array.isArray(a.sessions)) return false;

  const seenIds = new Set<string>();
  for (const session of a.sessions) {
    if (!looksLikeSession(session)) return false;
    if (seenIds.has(session.id)) return false; // ID duplicado: no es una agenda válida
    seenIds.add(session.id);
  }

  return true;
}
