'use client';

import { describeFreshness, type AgendaRefreshStatus } from '@/lib/agenda-refresh';

interface Props {
  status: AgendaRefreshStatus;
  lastSuccessfulSyncAt: number | null;
  lastAttemptAt: number | null;
  /** Reloj reactivo del padre (ver `useNow`); 0 antes de montar en cliente. */
  now: number;
}

/** Estados que sí ameritan avisarle a un lector de pantalla. */
const ALERT_STATUSES = new Set<AgendaRefreshStatus>(['offline', 'error']);

/**
 * Indicador compacto de frescura del horario (Fase 3 de la spec de refresco
 * resiliente). Traduce `useAgendaRefresh` a un mensaje breve en español.
 *
 * El sondeo y los refrescos exitosos rutinarios NO llevan `role="status"` /
 * `aria-live`: son ruido para un lector de pantalla si se anunciaran cada vez
 * que cambia el "hace N s". Offline y error sí lo llevan, porque son
 * información que la persona necesita notar aunque no esté mirando la
 * pantalla en ese momento.
 */
export default function FreshnessIndicator({
  status,
  lastSuccessfulSyncAt,
  lastAttemptAt,
  now,
}: Props) {
  // `now` es 0 hasta que el padre monta en cliente (evita depender de
  // Date.now() durante la hidratación); "idle" es el estado previo al primer
  // chequeo, antes de que haya nada que mostrar.
  if (!now || status === 'idle') return null;

  const label = describeFreshness({ status, lastSuccessfulSyncAt, lastAttemptAt, now });
  if (!label) return null;

  const alerting = ALERT_STATUSES.has(status);

  return (
    <span
      className={`freshness freshness--${status}`}
      role={alerting ? 'status' : undefined}
      aria-live={alerting ? 'polite' : undefined}
    >
      {label}
    </span>
  );
}
