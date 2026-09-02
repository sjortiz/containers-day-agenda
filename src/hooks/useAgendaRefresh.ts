'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Agenda } from '@/types';
import { isNewerAgenda } from '@/lib/agenda-remote';
import {
  computeNextPollDelayMs,
  createAgendaRefreshController,
  deriveAgendaRefreshStatus,
  type AgendaRefreshController,
  type AgendaRefreshFailureReason,
  type AgendaRefreshOutcome,
  type AgendaRefreshStatus,
} from '@/lib/agenda-refresh';
import { loadAgendaCache, saveAgendaCache } from '@/lib/storage';
import { fetchSessionizeAgenda } from '@/lib/sessionize';

/** Cadencia de polling mientras la pestaña está visible y no hay fallas recientes. */
const DEFAULT_POLL_MS = 60_000;

export interface AgendaRefreshState {
  /** Agenda vigente: la del build, o una más nueva descargada en runtime. */
  agenda: Agenda;
  refreshing: boolean;
  lastAttemptAt: number | null;
  lastSuccessfulSyncAt: number | null;
  lastError: AgendaRefreshFailureReason | null;
  /** Fallas consecutivas desde el último éxito; alimenta el backoff del polling. */
  consecutiveFailures: number;
  /** Estado agregado para la UI de frescura. Ver `deriveAgendaRefreshStatus`. */
  status: AgendaRefreshStatus;
  /** Fuerza un chequeo de inmediato (deduplicado si ya hay uno en curso). */
  requestRefresh: () => void;
}

export interface UseAgendaRefreshOptions {
  /** Milisegundos entre sondeos mientras el documento está visible y sin fallas recientes. */
  pollMs?: number;
  /** Desactiva la red para agendas importadas como una copia local. */
  enabled?: boolean;
}

/**
 * Mantiene la agenda sincronizada con su fuente remota de forma independiente
 * del estado de las notificaciones: pide el horario al montar, sondea solo
 * mientras la pestaña está visible, y vuelve a chequear al recuperar
 * visibilidad, foco o conexión. Toda la coordinación de la petición (dedupe,
 * timeout, abort, protección contra respuestas obsoletas) vive en
 * `createAgendaRefreshController`; este hook solo la conecta al ciclo de vida
 * de React y del navegador, la reintenta con backoff acotado tras fallas, y
 * cachea el resultado en localStorage.
 */
export function useAgendaRefresh(
  eventId: string,
  initialAgenda: Agenda,
  { pollMs = DEFAULT_POLL_MS, enabled = true }: UseAgendaRefreshOptions = {},
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
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // Espejo en ref de `consecutiveFailures`: `requestRefresh` lo necesita para
  // calcular el próximo delay en el mismo tick en que la petición se
  // resuelve, sin esperar al siguiente render (el estado de React se
  // actualiza de forma asíncrona).
  const consecutiveFailuresRef = useRef(0);

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

  // Cadencia base configurada, accesible desde `requestRefresh` sin que este
  // tenga que depender de `pollMs` (y así no reprogramar listeners de más).
  const pollMsRef = useRef(pollMs);
  useEffect(() => {
    pollMsRef.current = pollMs;
  }, [pollMs]);

  // Temporizador de auto-programación del próximo sondeo en segundo plano.
  // Reemplaza a un `setInterval` fijo porque el delay cambia con el backoff:
  // cada refresco reprograma el siguiente a partir de su propio resultado.
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Si el documento está oculto no hay que reprogramar sondeo alguno, aunque
  // un trigger explícito (foco, online, llamada pública) sí deba disparar.
  const pollingActiveRef = useRef(false);

  // Identidad de la promesa de `AgendaRefreshOutcome` cuyo `.then` ya está
  // "reclamado" para actualizar el estado y reprogramar el sondeo. Dos
  // triggers concurrentes (p. ej. poll y foco casi simultáneos) pueden
  // recibir la MISMA promesa deduplicada por el controller (`inFlight`); si
  // cada uno le enganchara su propio `.then`, una sola falla de red
  // incrementaría `consecutiveFailures` una vez por trigger en lugar de una
  // sola vez. Guardar acá la promesa ya "atendida" asegura que solo el
  // primer trigger que la ve procese su resolución.
  const handledOutcomePromiseRef =
    useRef<Promise<AgendaRefreshOutcome> | null>(null);

  // Punto único de entrada para disparar un refresco, sin importar la fuente
  // (montaje, visibilidad, foco, online, o la llamada pública). Al arrancar,
  // cancela cualquier sondeo auto-programado pendiente -para que un timer
  // viejo no dispare un refresco duplicado (ni suprima uno) poco después de
  // uno recién disparado por el ciclo de vida-, y al terminar reprograma el
  // próximo sondeo (si corresponde) a partir del resultado real de esta
  // petición. La dedupe entre triggers concurrentes la resuelve el
  // controller (`inFlight`); este hook, aparte, deduplica el `.then` que
  // procesa esa resolución (ver `handledOutcomePromiseRef`).
  //
  // Deps vacías a propósito: solo lee/escribe refs y setters estables de
  // `useState`, así que es la misma función en todos los renders. Se
  // referencia a sí misma (para auto-programar el siguiente sondeo) desde
  // dentro del `.then`, que corre después de que esta constante ya quedó
  // asignada.
  const requestRefresh = useCallback((): void => {
    const controller = controllerRef.current;
    if (!controller) return;

    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setRefreshing(true);
    setLastAttemptAt(Date.now());

    const outcomePromise = controller.requestRefresh();

    // Ya hay un `.then` reclamado sobre esta misma promesa (otro trigger
    // llegó primero, o llegó en el mismo tick): no engancharle uno más.
    if (handledOutcomePromiseRef.current === outcomePromise) return;
    handledOutcomePromiseRef.current = outcomePromise;

    void outcomePromise.then((outcome) => {
      if (handledOutcomePromiseRef.current === outcomePromise) {
        handledOutcomePromiseRef.current = null;
      }

      // El controller que emitió esta promesa ya no es el activo: fue
      // dispuesto (desmontaje real, o el replay de React Strict Mode lo
      // reemplazó por uno nuevo). Su resolución -incluso si no es un abort
      // explícito- no debe tocar el estado, ni timers, ni interferir con el
      // controller vigente.
      if (controllerRef.current !== controller) return;

      setRefreshing(false);

      if (outcome.kind === 'failed') {
        // Un abort no es una falla real de red/servidor: ocurre por
        // desmontaje, disposición del controller, o por haber sido
        // reemplazado por una petición más nueva. Contarlo alimentaría el
        // backoff (y la UI de estado) con ruido ajeno a la conectividad real.
        if (outcome.reason !== 'aborted') {
          consecutiveFailuresRef.current += 1;
          setConsecutiveFailures(consecutiveFailuresRef.current);
          setLastError(outcome.reason);
        }
      } else {
        consecutiveFailuresRef.current = 0;
        setConsecutiveFailures(0);
        setLastError(null);
        setLastSuccessfulSyncAt(Date.now());
      }

      if (pollingActiveRef.current) {
        // Limpiar acá también, no solo al inicio de `requestRefresh`, cubre
        // el caso en que este `.then` es el único reclamado para una promesa
        // deduplicada, pero de todas formas ya hay un timer pendiente de un
        // sondeo posterior -no debería darse en el flujo normal, pero deja
        // la invariante de "un único temporizador activo" a salvo de todas
        // formas.
        if (pollTimerRef.current !== null) {
          clearTimeout(pollTimerRef.current);
        }
        const delay = computeNextPollDelayMs(
          consecutiveFailuresRef.current,
          pollMsRef.current,
        );
        pollTimerRef.current = setTimeout(requestRefresh, delay);
      }
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = createAgendaRefreshController({
      getCurrentAgenda: () => agendaRef.current,
      fetchAgenda: agendaRef.current.event.provider === 'sessionize'
        ? (signal) => fetchSessionizeAgenda(
            agendaRef.current.event.sourceUrl,
            signal,
            agendaRef.current.event,
          )
        : undefined,
      onUpdate: (fresh) => {
        if (fresh.event.id !== eventId) return;
        agendaRef.current = fresh;
        saveAgendaCache(eventId, fresh);
        setAgenda(fresh);
      },
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
      // El `.then` pendiente de este controller ya se auto-descarta (ver
      // guard por identidad de controller en `requestRefresh`), pero soltar
      // la referencia acá también evita que quede apuntando a una promesa de
      // un controller ya disposed una vez que este efecto se limpia.
      handledOutcomePromiseRef.current = null;
    };
  }, [agendaRef, enabled, eventId]);

  // Al montar: si en una visita previa guardamos un horario más nuevo que el
  // horneado en build, lo adoptamos antes (o en paralelo) de ir a la red.
  useEffect(() => {
    const cached = loadAgendaCache(eventId);
    if (cached && isNewerAgenda(cached, agendaRef.current)) {
      agendaRef.current = cached;
      setAgenda(cached);
    }
  }, [agendaRef, eventId]);

  // Chequeo de red al montar, sin importar si las notificaciones están
  // habilitadas: la agenda debe mantenerse fresca para todo el mundo.
  useEffect(() => {
    if (!enabled) return;
    requestRefresh();
  }, [enabled, requestRefresh]);

  // Sondeo solo mientras el documento está visible; se detiene al ocultarse y
  // vuelve a chequear (y a sondear) al recuperar visibilidad. También
  // refresca al recuperar el foco de la ventana o la conexión. El propio
  // `requestRefresh` se encarga de auto-programar el siguiente sondeo tras
  // resolver, así que acá solo hace falta marcar si el sondeo en segundo
  // plano debe estar activo y disparar los triggers de ciclo de vida.
  useEffect(() => {
    if (!enabled) return;
    pollingActiveRef.current = !document.hidden;

    const onVisibilityChange = () => {
      if (document.hidden) {
        pollingActiveRef.current = false;
        if (pollTimerRef.current !== null) {
          clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        return;
      }
      pollingActiveRef.current = true;
      requestRefresh();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', requestRefresh);
    window.addEventListener('online', requestRefresh);

    return () => {
      pollingActiveRef.current = false;
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', requestRefresh);
      window.removeEventListener('online', requestRefresh);
    };
  }, [enabled, requestRefresh]);

  const status = deriveAgendaRefreshStatus({
    refreshing,
    consecutiveFailures,
    lastError,
    hasSyncedOnce: lastSuccessfulSyncAt !== null,
  });

  return {
    agenda,
    refreshing,
    lastAttemptAt,
    lastSuccessfulSyncAt,
    lastError,
    consecutiveFailures,
    status,
    requestRefresh,
  };
}
