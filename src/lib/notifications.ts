import { withBase } from '@/config';

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermission(): NotifPermission {
  if (!isSupported()) return 'unsupported';
  return Notification.permission as NotifPermission;
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

/** navigator.serviceWorker.ready pero sin colgarse si el SW nunca activa. */
function swReadyWithTimeout(
  ms: number,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
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

  const reg = await swReadyWithTimeout(3000);
  if (reg) {
    try {
      await reg.showNotification(title, options);
      return true;
    } catch {
      /* cae al fallback directo */
    }
  }

  try {
    new Notification(title, { body, tag, icon });
    return true;
  } catch {
    // Android exige SW; si llegamos aquí sin SW listo, no hay forma de mostrarla.
    return false;
  }
}
