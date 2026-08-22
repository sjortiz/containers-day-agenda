/**
 * Persistencia en localStorage: qué charlas eligió la persona y para cuáles ya
 * disparamos el aviso (para no repetirlo). Todo es por-dispositivo, sin backend.
 */
const SELECTED_KEY = 'cd-agenda:selected:v1';
const NOTIFIED_KEY = 'cd-agenda:notified:v1';

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
