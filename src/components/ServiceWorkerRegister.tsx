'use client';

import { useEffect } from 'react';
import { withBase } from '@/config';

/** Registra el service worker (offline + notificaciones). No renderiza nada. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register(withBase('/sw.js'), { scope: withBase('/') })
      .catch(() => {
        /* registro fallido: la app sigue funcionando sin offline/SW */
      });
  }, []);

  return null;
}
