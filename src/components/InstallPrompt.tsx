'use client';

import { useEffect, useState } from 'react';

/** Evento no estándar de Chromium para instalar la PWA. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Aviso para instalar la app en el inicio.
 * - Chromium (Android/desktop): usa el prompt nativo (`beforeinstallprompt`).
 * - iOS Safari: no hay prompt, así que mostramos el instructivo manual.
 * No se muestra si la app ya está instalada (standalone) o si el usuario cierra.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [platform, setPlatform] = useState<'native' | 'ios' | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (standalone) return; // ya instalada: nada que mostrar

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) setPlatform('ios');

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // evita el mini-infobar; mostramos nuestro botón
      setDeferred(e as BeforeInstallPromptEvent);
      setPlatform('native');
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden || !platform) return null;

  if (platform === 'native') {
    if (!deferred) return null;
    return (
      <div className="install" role="note">
        <span className="install__text">
          📲 Instala la app en tu inicio para recibir avisos y abrirla a
          pantalla completa.
        </span>
        <button
          type="button"
          className="install__btn"
          onClick={async () => {
            const evt = deferred;
            setDeferred(null);
            try {
              await evt.prompt();
              await evt.userChoice;
            } catch {
              /* el usuario canceló o el navegador rechazó el prompt */
            }
          }}
        >
          Instalar app
        </button>
        <button
          type="button"
          className="install__x"
          aria-label="Descartar"
          onClick={() => setHidden(true)}
        >
          ✕
        </button>
      </div>
    );
  }

  // iOS: instructivo manual (no existe prompt programático).
  return (
    <div className="install" role="note">
      <span className="install__text">
        📲 Para instalarla en iPhone/iPad: toca <strong>Compartir</strong> ▸{' '}
        <strong>Agregar a inicio</strong>, y abre la app desde el ícono.
      </span>
      <button
        type="button"
        className="install__x"
        aria-label="Descartar"
        onClick={() => setHidden(true)}
      >
        ✕
      </button>
    </div>
  );
}
