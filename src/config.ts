/**
 * Config compartida por la app. Debe mantenerse coherente con next.config.mjs.
 *
 * NEXT_PUBLIC_BASE_PATH se inyecta en build. En un GitHub Pages "project page"
 * vale "/<repo>"; en dev local o dominio propio vale "".
 */
const isProd = process.env.NODE_ENV === 'production';

export const BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  (isProd ? '/containers-day-agenda' : '');

/** Minutos de antelación con los que avisamos antes de cada charla. */
export const NOTIFY_LEAD_MINUTES = 10;

/**
 * Retraso del evento (en minutos) para mostrar un cartel arriba de la agenda,
 * tipo "⏱ El evento va ~10 min atrasado". Es solo un aviso visible: NO cambia
 * los horarios ni los avisos locales (para eso hay que mover el agenda.json).
 * Cambia este número para actualizar el texto, o ponlo en 0 para quitar el
 * cartel; luego vuelve a desplegar.
 */
export const EVENT_DELAY_MINUTES = 0;

export const APP_NAME = 'Talk Track · Mis eventos';
export const APP_SHORT_NAME = 'Talk Track';

/** Prefija una ruta absoluta del sitio con el basePath (assets, sw, iconos). */
export function withBase(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}
