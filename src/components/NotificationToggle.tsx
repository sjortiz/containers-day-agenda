'use client';

import type { NotifPermission } from '@/lib/notifications';

interface Props {
  permission: NotifPermission;
  enabled: boolean;
  onToggle: () => void;
  onTest: () => void;
}

export default function NotificationToggle({
  permission,
  enabled,
  onToggle,
  onTest,
}: Props) {
  if (permission === 'unsupported') {
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
      </span>
    </div>
  );
}
