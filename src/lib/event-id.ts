/**
 * Validación de IDs de evento: deben ser seguros tanto en URLs
 * (`/event/?id=<id>`, Fase 2 de la spec) como en claves de localStorage
 * (`talk-track:<id>:...`, ver storage.ts). Un ID inválido no debe poder
 * escapar ni el namespace de claves ni el de la URL: nada de `:` (rompería
 * el parseo de la clave), `/` (path traversal), espacios, mayúsculas ni
 * longitudes arbitrarias.
 */

/** minúsculas/dígitos separados por guiones simples; sin guion al inicio/fin. */
const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_EVENT_ID_LENGTH = 100;

/** IDs reservados que no pueden registrarse como evento (colisionan con otras claves/rutas). */
const RESERVED_EVENT_IDS = new Set(['events']);

/** Type guard estricto: no lanza, cualquier forma inesperada devuelve `false`. */
export function isValidEventId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= MAX_EVENT_ID_LENGTH &&
    EVENT_ID_PATTERN.test(id) &&
    !RESERVED_EVENT_IDS.has(id)
  );
}

/** ID fijo del evento sembrado por la migración inicial (ver storage.ts). */
export const CONTAINERS_DAY_EVENT_ID = 'containers-day';
