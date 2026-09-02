import type { Agenda, Session } from '@/types';
import { toMs } from './time';

/** Un bloque de sesiones que comparten la misma hora de inicio. */
export interface TimeSlot {
  start: string;
  sessions: Session[];
}

/** Agrupa por hora de inicio, ordenado cronológicamente. */
export function groupByStart(sessions: Session[]): TimeSlot[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const arr = map.get(s.start);
    if (arr) arr.push(s);
    else map.set(s.start, [s]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([start, list]) => ({
      start,
      sessions: list.sort((a, b) => a.room.localeCompare(b.room)),
    }));
}

export interface Filters {
  rooms: Set<string>;
  labels: Set<string>;
  query: string;
  onlyMine: boolean;
}

export function filterSessions(
  agenda: Agenda,
  filters: Filters,
  selectedIds: Set<string>,
): Session[] {
  const q = filters.query.trim().toLowerCase();
  return agenda.sessions.filter((s) => {
    if (filters.onlyMine && !selectedIds.has(s.id)) return false;
    if (filters.rooms.size && !filters.rooms.has(s.room)) return false;
    if (filters.labels.size && !s.labels.some((l) => filters.labels.has(l)))
      return false;
    if (q) {
      const hay = `${s.title} ${s.room} ${s.speakers.join(' ')} ${s.labels.join(
        ' ',
      )}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * IDs que se avisan automáticamente sin que el usuario los marque: los servicios
 * (registro, breaks, ceremonias). Las charlas de única opción también entran en
 * la agenda por defecto, pero via selección sembrada (ver `soleOptionIds`), para
 * que desmarcarlas SÍ cancele su aviso; por eso aquí solo van los servicios.
 */
export function autoAnnouncedIds(agenda: Agenda): Set<string> {
  const ids = new Set<string>();
  for (const s of agenda.sessions) {
    if (s.isService) ids.add(s.id);
  }
  return ids;
}

/**
 * Charlas que son la ÚNICA opción de su franja y no son servicios: como no hay
 * nada que elegir, arrancan marcadas por defecto (las sembramos en la selección
 * la primera vez que se ven). La persona puede desmarcarlas si no quiere el aviso.
 */
export function soleOptionIds(agenda: Agenda): Set<string> {
  const ids = new Set<string>();
  for (const slot of groupByStart(agenda.sessions)) {
    if (slot.sessions.length !== 1) continue;
    const s = slot.sessions[0];
    if (!s.isService) ids.add(s.id);
  }
  return ids;
}

/**
 * Identidad estable de una "ocurrencia" de aviso: el ID de sesión solo no
 * alcanza porque el mismo ID puede recibir un horario distinto. Codificar el
 * `start` vigente en la clave hace que un cambio de horario cuente como una
 * ocurrencia nueva, elegible para un aviso propio.
 */
export function occurrenceKey(id: string, start: string): string {
  return `${id}@${start}`;
}

/** Separa una clave `id@start` en sus partes; una entrada legado (sin `@`) devuelve `start: null`. */
function parseOccurrenceKey(key: string): { id: string; start: string | null } {
  const at = key.indexOf('@');
  if (at === -1) return { id: key, start: null };
  return { id: key.slice(0, at), start: key.slice(at + 1) };
}

/**
 * Reconcilia el set de "ya avisado" contra la agenda vigente. Acepta tanto
 * claves nuevas (`id@start`) como entradas legado de solo-ID (formato previo
 * a esta migración) y las trata así:
 *
 * - Sesión eliminada: se descarta el flag huérfano.
 * - Clave con `start` que ya no coincide con el vigente (la organización movió
 *   el horario): se descarta sin más, para que la ocurrencia nueva quede
 *   pendiente y el aviso se re-evalúe contra la hora correcta.
 * - Entrada legado o clave con `start` vigente: se conserva (migrada a la
 *   clave con `start`) solo si su ventana ya abrió (now >= start - lead); si
 *   todavía es futura, se descarta para que el aviso se dispare a tiempo.
 */
export function reconcileNotified(
  notified: Set<string>,
  agenda: Agenda,
  now: number,
  leadMs: number,
): Set<string> {
  const byId = new Map(agenda.sessions.map((s) => [s.id, s] as const));
  const next = new Set<string>();
  for (const key of notified) {
    const { id, start } = parseOccurrenceKey(key);
    const s = byId.get(id);
    if (!s) continue; // sesión eliminada/renombrada: limpiamos el flag huérfano
    if (start !== null && start !== s.start) continue; // ocurrencia vieja: el horario cambió
    if (now >= toMs(s.start) - leadMs) next.add(occurrenceKey(s.id, s.start)); // ventana ya abierta: se queda (migrada)
    // ventana aún futura -> lo dejamos fuera para que el aviso se re-dispare
  }
  return next;
}

/** Próxima sesión seleccionada que aún no empieza (o null). */
export function nextUpcomingSelected(
  agenda: Agenda,
  selectedIds: Set<string>,
  now: number = Date.now(),
): Session | null {
  const upcoming = agenda.sessions
    .filter((s) => selectedIds.has(s.id) && toMs(s.start) > now)
    .sort((a, b) => toMs(a.start) - toMs(b.start));
  return upcoming[0] ?? null;
}
