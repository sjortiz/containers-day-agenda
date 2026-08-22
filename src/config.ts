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

export const APP_NAME = 'Mi Agenda · Containers Day';
export const APP_SHORT_NAME = 'CD Agenda';

/** Prefija una ruta absoluta del sitio con el basePath (assets, sw, iconos). */
export function withBase(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}
