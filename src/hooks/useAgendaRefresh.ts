'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Agenda } from '@/types';
import { isNewerAgenda } from '@/lib/agenda-remote';
import {
  createAgendaRefreshController,
  type AgendaRefreshController,
  type AgendaRefreshFailureReason,
} from '@/lib/agenda-refresh';
import { loadAgendaCache, saveAgendaCache } from '@/lib/storage';

/** Cadencia de polling mientras la pestaña está visible. */
const DEFAULT_POLL_MS = 60_000;

export interface AgendaRefreshState {
  /** Agenda vigente: la del build, o una más nueva descargada en runtime. */
  agenda: Agenda;
  refreshing: boolean;
  lastAttemptAt: number | null;
  lastSuccessfulSyncAt: number | null;
  lastError: AgendaRefreshFailureReason | null;
  /** Fuerza un chequeo de inmediato (deduplicado si ya hay uno en curso). */
  requestRefresh: () => void;
}

export interface UseAgendaRefreshOptions {
  /** Milisegundos entre sondeos mientras el documento está visible. */
  pollMs?: number;
}

/**
 * Mantiene la agenda sincronizada con `/agenda.json` de forma independiente
 * del estado de las notificaciones: pide el horario al montar, sondea solo
 * mientras la pestaña está visible, y vuelve a chequear al recuperar
 * visibilidad, foco o conexión. Toda la coordinación de la petición (dedupe,
 * timeout, abort, protección contra respuestas obsoletas) vive en
 * `createAgendaRefreshController`; este hook solo la conecta al ciclo de vida
 * de React y del navegador, y cachea el resultado en localStorage.
 */
export function useAgendaRefresh(
  initialAgenda: Agenda,
  { pollMs = DEFAULT_POLL_MS }: UseAgendaRefreshOptions = {},
): AgendaRefreshState {
  const [agenda, setAgenda] = useState<Agenda>(initialAgenda);
  const [refreshing, setRefreshing] = useState(false);
  const [lastAttemptAt, setLastAttemptAt] = useState<number | null>(null);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<
    number | null
  >(null);
  const [lastError, setLastError] = useState<AgendaRefreshFailureReason | null>(
    null,
  );

  // La agenda "vigente" para el controller vive en un ref para que
  // getCurrentAgenda/onUpdate (capturados una sola vez abajo) siempre lean y
  // escriban el valor más reciente, sin recrear el controller en cada render.
  const [agendaRef] = useState(() => ({ current: initialAgenda }));
  useEffect(() => {
    agendaRef.current = agenda;
  }, [agenda, agendaRef]);

  // El controller vive en un ref -no en `useState`- y se crea/destruye desde
  // un único efecto (ver más abajo). Si lo creáramos una sola vez con
  // `useState(() => ...)` y solo lo dispusiéramos en la limpieza del efecto de
  // desmontaje, el replay de React Strict Mode en desarrollo (monta → limpia
  // → vuelve a montar los efectos, reutilizando esa misma instancia de
  // estado) dejaría a ese controller `disposed` para siempre: todo refresco
  // posterior se resolvería como abortado. Recrearlo en cada montaje de
  // efecto evita eso, porque el replay siempre produce un controller nuevo,
  // y sigue abortando de verdad ante un desmontaje real.
  const controllerRef = useRef<AgendaRefreshController | null>(null);

  const requestRefresh = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    setRefreshing(true);
    setLastAttemptAt(Date.now());
    void controller.requestRefresh().then((outcome) => {
      setRefreshing(false);
      if (outcome.kind === 'failed') {
        setLastError(outcome.reason);
        return;
      }
      setLastError(null);
      setLastSuccessfulSyncAt(Date.now());
    });
  }, []);

  useEffect(() => {
    const controller = createAgendaRefreshController({
      getCurrentAgenda: () => agendaRef.current,
      onUpdate: (fresh) => {
        agendaRef.current = fresh;
        saveAgendaCache(fresh);
        setAgenda(fresh);
      },
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [agendaRef]);

  // Al montar: si en una visita previa guardamos un horario más nuevo que el
  // horneado en build, lo adoptamos antes (o en paralelo) de ir a la red.
  useEffect(() => {
    const cached = loadAgendaCache();
    if (cached && isNewerAgenda(cached, agendaRef.current)) {
      agendaRef.current = cached;
      setAgenda(cached);
    }
  }, [agendaRef]);

  // Chequeo de red al montar, sin importar si las notificaciones están
  // habilitadas: la agenda debe mantenerse fresca para todo el mundo.
  useEffect(() => {
    requestRefresh();
  }, [requestRefresh]);

  // Sondeo solo mientras el documento está visible; se detiene al ocultarse y
  // vuelve a chequear (y a sondear) al recuperar visibilidad. También
  // refresca al recuperar el foco de la ventana o la conexión.
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(requestRefresh, pollMs);
    };
    const stopPolling = () => {
      if (intervalId === null) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }
      requestRefresh();
      startPolling();
    };

    if (!document.hidden) startPolling();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', requestRefresh);
    window.addEventListener('online', requestRefresh);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', requestRefresh);
      window.removeEventListener('online', requestRefresh);
    };
  }, [requestRefresh, pollMs]);

  return {
    agenda,
    refreshing,
    lastAttemptAt,
    lastSuccessfulSyncAt,
    lastError,
    requestRefresh,
  };
}
