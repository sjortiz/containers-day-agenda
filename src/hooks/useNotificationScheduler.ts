'use client';

import { useEffect, useRef } from 'react';
import type { Agenda } from '@/types';
import { NOTIFY_LEAD_MINUTES } from '@/config';
import { toMs } from '@/lib/time';
import { showNotification } from '@/lib/notifications';
import { loadNotified, saveNotified } from '@/lib/storage';

interface Params {
  agenda: Agenda;
  selectedIds: Set<string>;
  enabled: boolean;
}

/**
 * Dispara una notificación NOTIFY_LEAD_MINUTES antes de cada charla seleccionada.
 *
 * En un sitio estático no hay push del servidor: esto corre mientras la PWA está
 * abierta (aunque sea en segundo plano). Revisa cada 30s y también al recuperar foco;
 * los avisos ya emitidos se guardan en localStorage para no repetirse.
 */
export function useNotificationScheduler({
  agenda,
  selectedIds,
  enabled,
}: Params): void {
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    notifiedRef.current = loadNotified();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const lead = NOTIFY_LEAD_MINUTES * 60000;

    const check = () => {
      const now = Date.now();
      for (const s of agenda.sessions) {
        if (!selectedIds.has(s.id)) continue;
        const start = toMs(s.start);
        const inWindow = now >= start - lead && now < start;
        if (!inWindow || notifiedRef.current.has(s.id)) continue;

        notifiedRef.current.add(s.id);
        saveNotified(notifiedRef.current);

        const mins = Math.max(1, Math.round((start - now) / 60000));
        const speaker = s.speakers.length
          ? ` · ${s.speakers.join(', ')}`
          : '';
        // Breaks/ceremonias no son "charlas": título genérico.
        const heading = s.isService
          ? `${s.title} en ${mins} min`
          : `Tu charla empieza en ${mins} min`;
        const body = s.isService
          ? `📍 ${s.room}`
          : `${s.title}\n📍 ${s.room}${speaker}`;
        void showNotification(heading, {
          body,
          tag: `session-${s.id}`,
        });
      }
    };

    check();
    const id = setInterval(check, 30000);
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [agenda, selectedIds, enabled]);
}
