'use client';

import { useEffect, useState } from 'react';

/**
 * Reloj reactivo. Devuelve 0 hasta montar en cliente (evita mismatch de
 * hidratación con el HTML pre-renderizado). Re-tickea al volver a foco.
 */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => {
      if (!document.hidden) setNow(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return now;
}
