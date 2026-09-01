'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Agenda } from '@/types';
import { NOTIFY_LEAD_MINUTES } from '@/config';
import { toMs } from '@/lib/time';
import { occurrenceKey, reconcileNotified } from '@/lib/agenda';
import { showNotification } from '@/lib/notifications';
import { loadNotified, saveNotified } from '@/lib/storage';

interface Params {
  agenda: Agenda;
  selectedIds: Set<string>;
  enabled: boolean;
}

const LEAD_MS = NOTIFY_LEAD_MINUTES * 60000;

/**
 * Dispara una notificación NOTIFY_LEAD_MINUTES antes de cada charla seleccionada.
 *
 * En un sitio estático no hay push del servidor: esto corre mientras la PWA está
 * abierta (aunque sea en segundo plano). Revisa cada 30s y también al recuperar foco;
 * los avisos ya emitidos se guardan en localStorage como claves `id@start`
 * (ver `occurrenceKey`), para que un cambio de horario cuente como una
 * ocurrencia nueva en vez de deduplicarse contra la vieja.
 *
 * Este hook solo se ocupa de notificaciones: mantener la agenda al día es
 * responsabilidad de `useAgendaRefresh`, que corre de forma independiente.
 */
export function useNotificationScheduler({
  agenda,
  selectedIds,
  enabled,
}: Params): void {
  const notifiedRef = useRef<Set<string>>(new Set());

  // Reconcilia los avisos ya emitidos contra los horarios vigentes: si una
  // charla se movió, su ocurrencia vieja se descarta y la nueva queda
  // pendiente para evaluarse a la hora correcta. También migra entradas
  // legado de solo-ID al formato `id@start`.
  const reconcile = useCallback(() => {
    const stored = loadNotified();
    const reconciled = reconcileNotified(stored, agenda, Date.now(), LEAD_MS);
    notifiedRef.current = reconciled;
    // Persistimos siempre: una migración de `id` a `id@start` puede cambiar el
    // contenido sin cambiar el tamaño del set.
    saveNotified(reconciled);
  }, [agenda]);

  const check = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    for (const s of agenda.sessions) {
      if (!selectedIds.has(s.id)) continue;
      const start = toMs(s.start);
      const inWindow = now >= start - LEAD_MS && now < start;
      const key = occurrenceKey(s.id, s.start);
      if (!inWindow || notifiedRef.current.has(key)) continue;

      notifiedRef.current.add(key);
      saveNotified(notifiedRef.current);

      const mins = Math.max(1, Math.round((start - now) / 60000));
      const speaker = s.speakers.length ? ` · ${s.speakers.join(', ')}` : '';
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
  }, [agenda, selectedIds, enabled]);

  // Un agenda prop más nuevo (rebuild o refresco en runtime) debe reevaluarse
  // de inmediato en vez de esperar al próximo tick del intervalo: reconciliar
  // primero (para descartar ocurrencias viejas tras un cambio de horario) y
  // luego chequear con el estado ya al día.
  useEffect(() => {
    reconcile();
    check();
  }, [reconcile, check]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(check, 30000);
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, check]);
}
