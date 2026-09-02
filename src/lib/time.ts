/**
 * Helpers de tiempo. Los `start`/`end` vienen como ISO con offset del evento,
 * así que new Date(iso) da el instante absoluto correcto en cualquier device.
 * Para *mostrar* la hora usamos la timezone del evento (coincide con la agenda impresa).
 */

export function toMs(iso: string): number {
  return new Date(iso).getTime();
}

export function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(new Date(iso));
}

export function formatTimeRange(
  start: string,
  end: string | null,
  tz: string,
): string {
  const s = formatTime(start, tz);
  return end ? `${s} – ${formatTime(end, tz)}` : s;
}

export function formatDayHeading(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  }).format(new Date(iso));
}

/** Minutos (con signo) entre ahora y el instante dado. Positivo = en el futuro. */
/** Texto humano de cuenta regresiva a partir de milisegundos restantes. */
export function describeCountdown(msUntil: number): string {
  if (msUntil <= 0) return 'empezando ahora';
  const totalMin = Math.floor(msUntil / 60000);
  if (totalMin < 1) return 'en menos de 1 min';
  if (totalMin < 60) return `en ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `en ${h} h ${m} min` : `en ${h} h`;
}

/**
 * Texto compacto de tiempo transcurrido ("25 s", "8 min", "2 h"), usado por el
 * indicador de frescura de la agenda. Recibe milisegundos ya transcurridos;
 * negativos (reloj o timestamps ligeramente desalineados) se tratan como 0
 * en vez de mostrar un tiempo "futuro" sin sentido.
 */
export function formatElapsed(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSec = Math.floor(clamped / 1000);
  if (totalSec < 60) return `${totalSec} s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  return `${h} h`;
}
