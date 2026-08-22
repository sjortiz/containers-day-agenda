'use client';

import { useEffect, useRef } from 'react';
import type { Agenda } from '@/types';
import { NOTIFY_LEAD_MINUTES } from '@/config';
import { toMs } from '@/lib/time';
import { reconcileNotified } from '@/lib/agenda';
import { scheduleJitterMs } from '@/lib/agenda-remote';
import { showNotification } from '@/lib/notifications';
import { loadNotified, saveNotified } from '@/lib/storage';

interface Params {
  agenda: Agenda;
  selectedIds: Set<string>;
  enabled: boolean;
  /**
   * Se invoca (con jitter) cada vez que se dispara un aviso, para que la app
   * vuelva a pedir el horario y se actualice si cambió. Opcional.
   */
  onScheduleRefresh?: () => void | Promise<void>;
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
  onScheduleRefresh,
}: Params): void {
  const notifiedRef = useRef<Set<string>>(new Set());
  // Timer del refresh jittereado y bandera para no encolar más de uno a la vez.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPendingRef = useRef(false);
  // Guardamos el callback en un ref para no re-crear el intervalo si cambia.
  const onRefreshRef = useRef(onScheduleRefresh);
  useEffect(() => {
    onRefreshRef.current = onScheduleRefresh;
  }, [onScheduleRefresh]);

  // Al montar (y si cambia la agenda por un rebuild), reconciliamos los avisos
  // ya emitidos contra los horarios vigentes: si una charla se movió a más tarde,
  // su aviso debe volver a quedar pendiente para dispararse a la nueva hora.
  useEffect(() => {
    const stored = loadNotified();
    const reconciled = reconcileNotified(
      stored,
      agenda,
      Date.now(),
      NOTIFY_LEAD_MINUTES * 60000,
    );
    notifiedRef.current = reconciled;
    if (reconciled.size !== stored.size) saveNotified(reconciled);
  }, [agenda]);

  useEffect(() => {
    if (!enabled) return;

    const lead = NOTIFY_LEAD_MINUTES * 60000;

    // Al avisar, re-pedimos el horario (con jitter 1s–2min) para no quedar con
    // datos viejos si la organización lo movió. Si ya hay uno encolado, no
    // encolamos otro aunque se disparen varios avisos en el mismo tick.
    const scheduleRefresh = () => {
      if (!onRefreshRef.current || refreshPendingRef.current) return;
      refreshPendingRef.current = true;
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        refreshPendingRef.current = false;
        void onRefreshRef.current?.();
      }, scheduleJitterMs());
    };

    const check = () => {
      const now = Date.now();
      for (const s of agenda.sessions) {
        if (!selectedIds.has(s.id)) continue;
        const start = toMs(s.start);
        const inWindow = now >= start - lead && now < start;
        if (!inWindow || notifiedRef.current.has(s.id)) continue;

        notifiedRef.current.add(s.id);
        saveNotified(notifiedRef.current);
        scheduleRefresh();

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
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      refreshPendingRef.current = false;
    };
  }, [agenda, selectedIds, enabled]);
}
