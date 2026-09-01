import { withBase } from '@/config';

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermission(): NotifPermission {
  if (!isSupported()) return 'unsupported';
  return Notification.permission as NotifPermission;
}

/** ¿Estamos en iOS/iPadOS? (incluye iPad moderno, que se reporta como MacIntel táctil). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export async function requestPermission(): Promise<NotifPermission> {
  if (!isSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result as NotifPermission;
  } catch {
    return getPermission();
  }
}

interface NotifyOptions {
  body: string;
  tag?: string;
}

/**
 * Tag de notificación con scope de evento: dos eventos (p. ej. dos
 * proveedores distintos) pueden reusar el mismo ID de sesión, y un `tag`
 * compartido haría que el navegador reemplace el aviso de uno con el del
 * otro. Prefijar con el event ID evita esa colisión.
 */
export function eventNotificationTag(eventId: string, suffix: string): string {
  return `${eventId}:${suffix}`;
}

/** Tag de notificación para una sesión concreta de un evento. */
export function sessionNotificationTag(eventId: string, sessionId: string): string {
  return eventNotificationTag(eventId, `session-${sessionId}`);
}

/**
 * Devuelve un registration del service worker usable para mostrar notificaciones.
 * Primero intenta uno ya activo (camino rápido: en una PWA instalada suele estarlo
 * al abrir), y si no, espera a `navigator.serviceWorker.ready` con timeout para no
 * colgarse si nunca activa. En iOS/Android instalado el SW es la ÚNICA vía válida
 * (`new Notification()` no está soportado), así que conviene esperarlo bien.
 */
async function getSWRegistration(
  ms: number,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing?.active) return existing;
  } catch {
    /* si getRegistration falla, caemos a esperar ready */
  }
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Muestra una notificación y devuelve si se pudo mostrar. Prefiere el service
 * worker: en Android Chrome `new Notification()` NO está soportado y lanza, así
 * que el SW es obligatorio ahí. Con timeout para no quedarse colgado si el SW
 * aún no activó, y con fallback a la Notification API directa (desktop).
 */
export async function showNotification(
  title: string,
  { body, tag }: NotifyOptions,
): Promise<boolean> {
  if (getPermission() !== 'granted') return false;
  const icon = withBase('/icons/icon-192.png');
  const badge = withBase('/icons/icon-192.png');
  const options = {
    body,
    tag,
    icon,
    badge,
    renotify: true,
    requireInteraction: true,
  } as NotificationOptions;

  const reg = await getSWRegistration(5000);
  if (reg) {
    try {
      await reg.showNotification(title, options);
      return true;
    } catch {
      /* cae al fallback directo */
    }
  }

  // Fallback directo (solo desktop): en iOS/Android instalado esto lanza y por
  // eso devolvemos false, que la UI traduce en "revisa el permiso".
  try {
    new Notification(title, { body, tag, icon });
    return true;
  } catch {
    return false;
  }
}
