/**
 * Coordinación central de los refrescos de agenda. Todas las fuentes que
 * quieren revalidar el horario (montaje, visibilidad, foco, `online`, polling)
 * deben llamar a `requestRefresh()`: acá se decide si hace falta una petición
 * nueva o si conviene reutilizar una que ya está en curso, se aplica un
 * timeout, y se protege el estado activo contra respuestas fuera de orden o
 * que llegan después de un desmontaje.
 *
 * Esta pieza es deliberadamente ajena a React y al DOM: solo depende de la
 * agenda actual (vía `getCurrentAgenda`) y de una función de fetch inyectable,
 * lo que la hace fácil de probar de forma determinista con `node:test`.
 */
import type { Agenda } from '@/types';
import {
  fetchPublishedAgenda,
  isNewerAgenda,
  type AgendaFetchFailureReason,
  type AgendaFetchResult,
} from './agenda-remote';

/** Ídem `AgendaFetchFailureReason`, más `'timeout'` (propio de este nivel). */
export type AgendaRefreshFailureReason = AgendaFetchFailureReason | 'timeout';

export type AgendaRefreshOutcome =
  | { kind: 'updated'; agenda: Agenda }
  | { kind: 'unchanged' }
  | { kind: 'failed'; reason: AgendaRefreshFailureReason };

export interface AgendaRefreshControllerOptions {
  /** Agenda vigente en el momento de comparar/aplicar el resultado. Se lee de
   * nuevo justo antes de aplicar, no en el momento en que se pidió el
   * refresco, para no regresar el estado si otra cosa ya lo actualizó. */
  getCurrentAgenda: () => Agenda;
  /** Se invoca únicamente cuando llega una agenda más nueva que la vigente. */
  onUpdate: (agenda: Agenda) => void;
  /** Milisegundos antes de abortar una petición en curso. */
  timeoutMs?: number;
  /** Punto de inyección para pruebas; por defecto pide `/agenda.json`. */
  fetchAgenda?: (signal: AbortSignal) => Promise<AgendaFetchResult>;
}

export interface AgendaRefreshController {
  /**
   * Punto único de entrada para disparar un refresco. Si ya hay una petición
   * en curso, la reutiliza en vez de arrancar (y abortar) otra: los triggers
   * rutinarios (poll, foco, visibilidad, online) se deduplican así.
   */
  requestRefresh: () => Promise<AgendaRefreshOutcome>;
  /** Aborta la petición en curso (si la hay) e ignora resultados futuros. */
  dispose: () => void;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** Delays (ms) de reintento para el polling en segundo plano tras fallas
 * consecutivas, indexados por cantidad de fallas (1ª falla -> 30s, 2ª -> 60s,
 * ...), con tope en la última entrada. */
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000];

/**
 * Delay hasta el próximo sondeo automático. Sin fallas recientes usa la
 * cadencia base configurada; cada falla consecutiva avanza en
 * `RETRY_DELAYS_MS`, topando en su última (y mayor) entrada. Función pura
 * -sin timers ni estado- para poder probar la secuencia de backoff de forma
 * determinista.
 */
export function computeNextPollDelayMs(
  consecutiveFailures: number,
  basePollMs: number,
): number {
  if (consecutiveFailures <= 0) return basePollMs;
  const index = Math.min(consecutiveFailures, RETRY_DELAYS_MS.length) - 1;
  return RETRY_DELAYS_MS[index];
}

export type AgendaRefreshStatus =
  | 'idle'
  | 'refreshing'
  | 'fresh'
  | 'offline'
  | 'error';

/**
 * Deriva el estado agregado de frescura (para la UI) a partir del
 * bookkeeping de refrescos. Función pura para poder verificar las
 * transiciones -por ejemplo, que un abort no cuenta como falla- sin montar
 * componentes de React.
 */
export function deriveAgendaRefreshStatus(state: {
  refreshing: boolean;
  consecutiveFailures: number;
  lastError: AgendaRefreshFailureReason | null;
  hasSyncedOnce: boolean;
}): AgendaRefreshStatus {
  if (state.refreshing) return 'refreshing';
  if (state.consecutiveFailures > 0) {
    return state.lastError === 'network' ? 'offline' : 'error';
  }
  return state.hasSyncedOnce ? 'fresh' : 'idle';
}

export function createAgendaRefreshController(
  options: AgendaRefreshControllerOptions,
): AgendaRefreshController {
  const {
    getCurrentAgenda,
    onUpdate,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchAgenda = fetchPublishedAgenda,
  } = options;

  let inFlight: Promise<AgendaRefreshOutcome> | null = null;
  let currentController: AbortController | null = null;
  // Generación monótona: además de comparar `fetchedAt` al aplicar, esto
  // protege contra aplicar una respuesta que llegó tarde para una petición ya
  // superada (por ejemplo, tras `dispose()`).
  let generation = 0;
  let disposed = false;

  function requestRefresh(): Promise<AgendaRefreshOutcome> {
    if (disposed) return Promise.resolve({ kind: 'failed', reason: 'aborted' });
    if (inFlight) return inFlight; // dedupe: reutiliza la petición en curso

    const myGeneration = ++generation;
    const controller = new AbortController();
    currentController = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const promise = fetchAgenda(controller.signal)
      .then((result): AgendaRefreshOutcome => {
        if (disposed || myGeneration !== generation) {
          return { kind: 'failed', reason: 'aborted' };
        }
        if (!result.ok) {
          return { kind: 'failed', reason: timedOut ? 'timeout' : result.reason };
        }
        // Segunda defensa (además del guard de generación): solo aplicamos si
        // sigue siendo más nueva que la agenda vigente en este instante.
        if (!isNewerAgenda(result.agenda, getCurrentAgenda())) {
          return { kind: 'unchanged' };
        }
        onUpdate(result.agenda);
        return { kind: 'updated', agenda: result.agenda };
      })
      .catch((): AgendaRefreshOutcome => ({
        kind: 'failed',
        reason: timedOut ? 'timeout' : 'network',
      }));

    // OJO: `promise.finally(...)` devuelve una promesa nueva, distinta de
    // `promise`. Si comparáramos `inFlight === promise` adentro del callback
    // estaríamos comparando esa promesa nueva contra la original -nunca son
    // iguales-, así que `inFlight` jamás volvería a `null` y todo refresco
    // posterior quedaría deduplicado contra una petición ya resuelta para
    // siempre. Por eso guardamos la referencia a la promesa que de verdad se
    // asigna a `inFlight` (`settled`) y comparamos contra esa.
    const settled = promise.finally(() => {
      clearTimeout(timer);
      if (currentController === controller) currentController = null;
      if (inFlight === settled) inFlight = null;
    });
    inFlight = settled;

    return settled;
  }

  function dispose(): void {
    disposed = true;
    currentController?.abort();
  }

  return { requestRefresh, dispose };
}
