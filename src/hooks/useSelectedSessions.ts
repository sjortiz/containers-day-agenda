'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadSelected, saveSelected } from '@/lib/storage';

export interface SelectedApi {
  selectedIds: Set<string>;
  hydrated: boolean;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
}

export function useSelectedSessions(): SelectedApi {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Cargamos desde localStorage solo en cliente (evita mismatch de hidratación).
  useEffect(() => {
    setSelectedIds(loadSelected());
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

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  return { selectedIds, hydrated, isSelected, toggle, clear };
}
