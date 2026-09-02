/**
 * Persistencia en localStorage, con scope por evento
 * (`talk-track:<event-id>:...`, ver docs/specs/multi-event-home.md): qué
 * charlas eligió la persona, para cuáles ya disparamos el aviso, y si las
 * notificaciones están habilitadas — todo por-evento y por-dispositivo, sin
 * backend. El índice de eventos (`talk-track:events:v1`) es la única clave
 * que no lleva scope: guarda solo metadata y orden, no agendas completas.
 */
import type { Agenda, EventMeta } from '@/types';
import { looksLikeAgenda, looksLikeEventMeta } from './agenda-validation';
import { CONTAINERS_DAY_EVENT_ID, isValidEventId } from './event-id';

const PREFIX = 'talk-track';
const EVENTS_INDEX_KEY = `${PREFIX}:events:v1`;

/** Construye una clave con scope de evento, o `null` si `eventId` es inválido
 * (así un ID inválido nunca produce una clave real ni pisa otro namespace). */
function eventKey(eventId: string, suffix: string): string | null {
  return isValidEventId(eventId) ? `${PREFIX}:${eventId}:${suffix}` : null;
}

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

// ---------------------------------------------------------------------------
// Migración legado (solo Containers Day, ver "Migración inicial" en la spec)
// ---------------------------------------------------------------------------

const LEGACY_SELECTED_KEY = 'cd-agenda:selected:v1';
const LEGACY_NOTIFIED_KEY = 'cd-agenda:notified:v1';
const LEGACY_SOLE_SEEDED_KEY = 'cd-agenda:sole-seeded:v1';
const LEGACY_AGENDA_KEY = 'cd-agenda:data:v1';
const LEGACY_NOTIF_ENABLED_KEY = 'cd-agenda:notif-enabled:v1';
const LEGACY_MIGRATION_MARKER_KEY = `${PREFIX}:legacy-migrated:v1`;

/** Copia `from` a `to` solo si `from` existe y `to` todavía no. Nunca borra `from`. */
function copyIfAbsent(from: string, to: string | null): void {
  if (to === null) return;
  if (window.localStorage.getItem(to) !== null) return; // destino con scope ya tiene datos: no pisar
  const legacy = window.localStorage.getItem(from);
  if (legacy === null) return; // nada legado que migrar
  window.localStorage.setItem(to, legacy);
}

/**
 * Migra una sola vez el estado plano legado (`cd-agenda:*`) de Containers Day
 * a sus claves con scope de evento. Copia solo si el destino con scope aún no
 * existe (nunca pisa datos ya migrados, ni datos ya escritos en las claves
 * nuevas) y conserva las claves legado intactas -las ocurrencias de aviso
 * legado quedan válidas: `reconcileNotified` (lib/agenda.ts) ya sabe migrar
 * entradas de solo-ID al formato `id@start` sin cambiar el tamaño del set.
 *
 * Guardada tras una marca en localStorage para no repetir el trabajo en cada
 * llamada. Se invoca antes de cada lectura con scope de Containers Day, así
 * que además de la marca es, en sí misma, idempotente por-clave
 * (comprobar-antes-de-copiar): a salvo del doble efecto que dispara React
 * Strict Mode en desarrollo, incluso si dos lecturas casi simultáneas la
 * disparan antes de que la marca llegue a escribirse.
 */
function ensureLegacyMigration(eventId: string): void {
  if (eventId !== CONTAINERS_DAY_EVENT_ID) return;
  if (!hasWindow()) return;
  try {
    if (window.localStorage.getItem(LEGACY_MIGRATION_MARKER_KEY) === 'done') return;

    copyIfAbsent(LEGACY_SELECTED_KEY, eventKey(eventId, 'selected:v1'));
    copyIfAbsent(LEGACY_NOTIFIED_KEY, eventKey(eventId, 'notified:v1'));
    copyIfAbsent(LEGACY_SOLE_SEEDED_KEY, eventKey(eventId, 'sole-seeded:v1'));
    copyIfAbsent(LEGACY_AGENDA_KEY, eventKey(eventId, 'agenda:v1'));
    copyIfAbsent(LEGACY_NOTIF_ENABLED_KEY, eventKey(eventId, 'notifications-enabled:v1'));

    window.localStorage.setItem(LEGACY_MIGRATION_MARKER_KEY, 'done');
  } catch {
    /* almacenamiento bloqueado: no hay nada seguro que hacer; se reintenta en la próxima lectura */
  }
}

// ---------------------------------------------------------------------------
// Sets con scope de evento: selección, avisos ya disparados, sembrado de
// charlas de única opción.
// ---------------------------------------------------------------------------

function loadSet(key: string | null): Set<string> {
  if (key === null || !hasWindow()) return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSet(key: string | null, set: Set<string>): void {
  if (key === null || !hasWindow()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* almacenamiento lleno o bloqueado: lo ignoramos silenciosamente */
  }
}

/** Clave real de `selected` para `eventId` (o `null` si el ID es inválido);
 * expuesta para que los hooks puedan reconocer eventos de `storage` entre pestañas. */
export function selectedStorageKey(eventId: string): string | null {
  return eventKey(eventId, 'selected:v1');
}

export function loadSelected(eventId: string): Set<string> {
  ensureLegacyMigration(eventId);
  return loadSet(selectedStorageKey(eventId));
}
export function saveSelected(eventId: string, set: Set<string>): void {
  saveSet(selectedStorageKey(eventId), set);
}

export function loadNotified(eventId: string): Set<string> {
  ensureLegacyMigration(eventId);
  return loadSet(eventKey(eventId, 'notified:v1'));
}
export function saveNotified(eventId: string, set: Set<string>): void {
  saveSet(eventKey(eventId, 'notified:v1'), set);
}

export function loadSoleSeeded(eventId: string): Set<string> {
  ensureLegacyMigration(eventId);
  return loadSet(eventKey(eventId, 'sole-seeded:v1'));
}
export function saveSoleSeeded(eventId: string, set: Set<string>): void {
  saveSet(eventKey(eventId, 'sole-seeded:v1'), set);
}

// ---------------------------------------------------------------------------
// Cache de agenda con scope de evento
// ---------------------------------------------------------------------------

export function loadAgendaCache(eventId: string): Agenda | null {
  ensureLegacyMigration(eventId);
  const key = eventKey(eventId, 'agenda:v1');
  if (key === null || !hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!looksLikeAgenda(data)) return null;
    // Defensa extra: una agenda válida pero de OTRO evento no debe poder
    // leerse bajo este scope (no debería pasar salvo bug/corrupción manual).
    if (data.event.id !== eventId) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveAgendaCache(eventId: string, agenda: Agenda): void {
  const key = eventKey(eventId, 'agenda:v1');
  if (key === null || !hasWindow()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(agenda));
  } catch {
    /* almacenamiento lleno o bloqueado: lo ignoramos silenciosamente */
  }
}

// ---------------------------------------------------------------------------
// Habilitación de notificaciones con scope de evento (reemplaza la clave
// component-local que vivía en AgendaApp.tsx).
// ---------------------------------------------------------------------------

export function loadNotificationsEnabled(eventId: string): boolean {
  ensureLegacyMigration(eventId);
  const key = eventKey(eventId, 'notifications-enabled:v1');
  if (key === null || !hasWindow()) return false;
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function saveNotificationsEnabled(eventId: string, enabled: boolean): void {
  const key = eventKey(eventId, 'notifications-enabled:v1');
  if (key === null || !hasWindow()) return;
  try {
    window.localStorage.setItem(key, enabled ? 'true' : 'false');
  } catch {
    /* almacenamiento lleno o bloqueado: lo ignoramos silenciosamente */
  }
}

// ---------------------------------------------------------------------------
// Índice de eventos (`talk-track:events:v1`): metadata y orden, sin agendas.
// ---------------------------------------------------------------------------

function looksLikeEventMetaArray(value: unknown): value is EventMeta[] {
  return Array.isArray(value) && value.every(looksLikeEventMeta);
}

/** Todos los eventos registrados, en el orden en que se guardaron. */
export function listEvents(): EventMeta[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_INDEX_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    return looksLikeEventMetaArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveEvents(events: EventMeta[]): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(EVENTS_INDEX_KEY, JSON.stringify(events));
  } catch {
    /* almacenamiento lleno o bloqueado: lo ignoramos silenciosamente */
  }
}

const EVENT_DATA_SUFFIXES = [
  'selected:v1',
  'notified:v1',
  'sole-seeded:v1',
  'agenda:v1',
  'notifications-enabled:v1',
] as const;

/** Removes an event and all of its device-local state. */
export function removeEvent(eventId: string): void {
  if (!isValidEventId(eventId) || !hasWindow()) return;
  try {
    saveEvents(listEvents().filter((event) => event.id !== eventId));
    for (const suffix of EVENT_DATA_SUFFIXES) {
      const key = eventKey(eventId, suffix);
      if (key) window.localStorage.removeItem(key);
    }
  } catch {
    /* almacenamiento bloqueado: no hay forma segura de completar el borrado */
  }
}

/** Inserta o actualiza (por `id`) un evento en el índice, preservando el
 * orden existente. No-op silencioso si `meta.id` no es un event ID válido. */
export function upsertEvent(meta: EventMeta): void {
  if (!isValidEventId(meta.id)) return;
  const events = listEvents();
  const idx = events.findIndex((e) => e.id === meta.id);
  if (idx === -1) events.push(meta);
  else events[idx] = meta;
  saveEvents(events);
}
