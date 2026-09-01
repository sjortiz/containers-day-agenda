/**
 * Persistencia en localStorage: qué charlas eligió la persona y para cuáles ya
 * disparamos el aviso (para no repetirlo). Todo es por-dispositivo, sin backend.
 */
import type { Agenda } from '@/types';

const SELECTED_KEY = 'cd-agenda:selected:v1';
// Ocurrencias de aviso ya disparadas, como claves `id@start` (ver
// `occurrenceKey` en `lib/agenda.ts`). Puede contener entradas legado de
// solo-ID de antes de esa migración; `reconcileNotified` las traduce/depura.
const NOTIFIED_KEY = 'cd-agenda:notified:v1';
// Charlas de "única opción" que ya sembramos como marcadas por defecto. Las
// guardamos aparte para sembrar cada una una sola vez: si la persona la desmarca
// luego, no se la volvemos a marcar en la siguiente carga.
const SOLE_SEEDED_KEY = 'cd-agenda:sole-seeded:v1';
// Última agenda descargada en runtime. Si en una visita bajamos un horario más
// nuevo que el del build, lo guardamos aquí para que la app no arranque vieja.
const AGENDA_KEY = 'cd-agenda:data:v1';

function loadSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* almacenamiento lleno o bloqueado: lo ignoramos silenciosamente */
  }
}

export const loadSelected = () => loadSet(SELECTED_KEY);
export const saveSelected = (set: Set<string>) => saveSet(SELECTED_KEY, set);

export const loadNotified = () => loadSet(NOTIFIED_KEY);
export const saveNotified = (set: Set<string>) => saveSet(NOTIFIED_KEY, set);

export const loadSoleSeeded = () => loadSet(SOLE_SEEDED_KEY);
export const saveSoleSeeded = (set: Set<string>) => saveSet(SOLE_SEEDED_KEY, set);

/** Valida mínimamente que el objeto parezca una Agenda antes de confiar en él. */
function looksLikeAgenda(data: unknown): data is Agenda {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as Agenda).sessions) &&
    typeof (data as Agenda).timezone === 'string' &&
    typeof (data as Agenda).fetchedAt === 'string'
  );
}

export function loadAgendaCache(): Agenda | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AGENDA_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return looksLikeAgenda(data) ? data : null;
  } catch {
    return null;
  }
}

export function saveAgendaCache(agenda: Agenda): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AGENDA_KEY, JSON.stringify(agenda));
  } catch {
    /* almacenamiento lleno o bloqueado: lo ignoramos silenciosamente */
  }
}
