'use client';

import type { NotifPermission } from '@/lib/notifications';

interface Props {
  permission: NotifPermission;
  enabled: boolean;
  onToggle: () => void;
  onTest: () => void;
  testMsg?: string | null;
}

export default function NotificationToggle({
  permission,
  enabled,
  onToggle,
  onTest,
  testMsg,
}: Props) {
  if (permission === 'unsupported') {
    // Detectar iOS y si está instalada como PWA
    let isIOS = false;
    let standalone = false;
    if (typeof window !== 'undefined') {
      isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      standalone = window.matchMedia('(display-mode: standalone)').matches ||
                   (navigator as any).standalone === true;
    }

    // Mensaje específico para iOS no instalado
    if (isIOS && !standalone) {
      return (
        <p className="notif notif--muted">
          En iPhone/iPad: toca Compartir ▸ 'Agregar a inicio' y abre la app desde el ícono para activar avisos (requiere iOS 16.4+). Mientras tanto verás el aviso en el banner de arriba.
        </p>
      );
    }

    // Mensaje genérico para otros casos
    return (
      <p className="notif notif--muted">
        Tu navegador no soporta notificaciones. Igual verás el aviso en el banner
        de arriba.
      </p>
    );
  }

  if (permission === 'denied') {
    return (
      <p className="notif notif--muted">
        🔕 Notificaciones bloqueadas. Actívalas en los permisos del sitio para
        recibir avisos; mientras tanto, usa el banner.
      </p>
    );
  }

  const active = enabled && permission === 'granted';

  return (
    <div className="notif">
      <button
        type="button"
        className={`notif__btn${active ? ' notif__btn--on' : ''}`}
        onClick={onToggle}
      >
        {active ? '🔔 Avisos activados' : '🔔 Activar avisos'}
      </button>
      {active && (
        <button type="button" className="notif__test" onClick={onTest}>
          Probar
        </button>
      )}
      <span className="notif__hint">
        Te avisamos 10 min antes de cada charla mientras la app esté abierta.
        {testMsg ? (
          <>
            <br />
            {testMsg}
          </>
        ) : null}
      </span>
    </div>
  );
}
