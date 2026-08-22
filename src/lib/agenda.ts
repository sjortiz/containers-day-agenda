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
 * IDs que se avisan automáticamente sin que el usuario los marque: los
 * servicios (registro, breaks, ceremonias) y cualquier sesión que sea la única
 * en su franja horaria (Keynote, Opening Remarks, etc. — no hay nada que elegir).
 */
export function autoAnnouncedIds(agenda: Agenda): Set<string> {
  const ids = new Set<string>();
  for (const slot of groupByStart(agenda.sessions)) {
    const alone = slot.sessions.length === 1;
    for (const s of slot.sessions) {
      if (s.isService || alone) ids.add(s.id);
    }
  }
  return ids;
}

/**
 * Reconcilia el set de "ya avisado" contra la agenda vigente. Cuando la
 * organización mueve los horarios, un ID que ya disparó su aviso al horario
 * viejo debe volver a quedar pendiente si su NUEVA ventana de aviso todavía no
 * llegó, para que el recordatorio se dispare a la hora correcta. También
 * descarta IDs de sesiones que ya no existen.
 *
 * Mantiene marcados solo los avisos cuya ventana ya abrió (now >= start - lead),
 * así no re-notificamos charlas en curso o ya pasadas.
 */
export function reconcileNotified(
  notified: Set<string>,
  agenda: Agenda,
  now: number,
  leadMs: number,
): Set<string> {
  const byId = new Map(agenda.sessions.map((s) => [s.id, s] as const));
  const next = new Set<string>();
  for (const id of notified) {
    const s = byId.get(id);
    if (!s) continue; // sesión eliminada/renombrada: limpiamos el flag huérfano
    if (now >= toMs(s.start) - leadMs) next.add(id); // ventana ya abierta: se queda
    // ventana aún futura -> lo dejamos fuera para que el aviso se re-dispare
  }
  return next;
}

/** Charlas seleccionadas ordenadas por hora de inicio. */
export function selectedSessions(
  agenda: Agenda,
  selectedIds: Set<string>,
): Session[] {
  return agenda.sessions
    .filter((s) => selectedIds.has(s.id))
    .sort((a, b) => (a.start < b.start ? -1 : 1));
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
