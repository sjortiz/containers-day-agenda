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

/**
 * Muestra una notificación. Prefiere el service worker (funciona mejor en móvil y
 * con la pestaña en segundo plano); si no hay SW, cae a la Notification API directa.
 */
export async function showNotification(
  title: string,
  { body, tag }: NotifyOptions,
): Promise<void> {
  if (getPermission() !== 'granted') return;
  const icon = withBase('/icons/icon-192.png');
  const badge = withBase('/icons/icon-192.png');

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        tag,
        icon,
        badge,
        renotify: true,
        requireInteraction: true,
      } as NotificationOptions);
      return;
    } catch {
      /* cae al fallback */
    }
  }

  try {
    new Notification(title, { body, tag, icon });
  } catch {
    /* algunos navegadores exigen SW para notificar; sin más opciones */
  }
}
