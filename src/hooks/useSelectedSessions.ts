'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadSelected,
  loadSoleSeeded,
  saveSelected,
  saveSoleSeeded,
} from '@/lib/storage';

export interface SelectedApi {
  selectedIds: Set<string>;
  hydrated: boolean;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
  /** Marca por defecto (una sola vez) las charlas de única opción indicadas. */
  seedDefaults: (ids: Set<string>) => void;
}

export function useSelectedSessions(): SelectedApi {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  // IDs ya sembrados como marcados por defecto; en ref para que `seedDefaults`
  // sea estable y no re-siembre lo que la persona pudo haber desmarcado.
  const seededRef = useRef<Set<string>>(new Set());

  // Cargamos desde localStorage solo en cliente (evita mismatch de hidratación).
  useEffect(() => {
    setSelectedIds(loadSelected());
    seededRef.current = loadSoleSeeded();
    setHydrated(true);
  }, []);

  // Sincroniza cambios entre pestañas.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cd-agenda:selected:v1') setSelectedIds(loadSelected());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persist = useCallback((next: Set<string>) => {
    setSelectedIds(next);
    saveSelected(next);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        saveSelected(next);
        return next;
      });
    },
    [],
  );

  const clear = useCallback(() => persist(new Set()), [persist]);

  const seedDefaults = useCallback((ids: Set<string>) => {
    // Solo sembramos los que nunca sembramos antes: así, si la persona desmarca
    // una charla de única opción, no se la volvemos a marcar en cada carga.
    const fresh = [...ids].filter((id) => !seededRef.current.has(id));
    if (fresh.length === 0) return;
    const nextSeeded = new Set(seededRef.current);
    fresh.forEach((id) => nextSeeded.add(id));
    seededRef.current = nextSeeded;
    saveSoleSeeded(nextSeeded);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      fresh.forEach((id) => next.add(id));
      saveSelected(next);
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  return { selectedIds, hydrated, isSelected, toggle, clear, seedDefaults };
}
