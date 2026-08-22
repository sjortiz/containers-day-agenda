'use client';

import { EVENT_DELAY_MINUTES } from '@/config';

/**
 * Cartel de "evento atrasado" que se muestra arriba de la agenda para quien la
 * abra. Es puramente informativo: NO mueve los horarios ni los avisos locales
 * (eso sería editar el agenda.json). Controlado por `EVENT_DELAY_MINUTES` en
 * config: 0 o negativo lo oculta; cambiar el número actualiza el texto.
 */
export default function DelayBanner() {
  if (!EVENT_DELAY_MINUTES || EVENT_DELAY_MINUTES <= 0) return null;

  return (
    <div className="delay-banner" role="status" aria-live="polite">
      <span className="delay-banner__icon" aria-hidden="true">
        ⏱
      </span>
      <p className="delay-banner__text">
        El evento va <strong>~{EVENT_DELAY_MINUTES} min atrasado</strong>. Las
        horas de abajo son las del programa; en la práctica cada charla puede
        empezar unos ~{EVENT_DELAY_MINUTES} min más tarde.
      </p>
    </div>
  );
}
