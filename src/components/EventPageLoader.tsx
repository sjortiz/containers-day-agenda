'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Agenda } from '@/types';
import { CONTAINERS_DAY_EVENT_ID, isValidEventId } from '@/lib/event-id';
import { loadAgendaCache, saveAgendaCache, upsertEvent } from '@/lib/storage';
import AgendaApp from './AgendaApp';
import { reconcileBundledAgenda } from '@/lib/bundled-agenda';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'missing' }
  | { kind: 'ready'; agenda: Agenda };

export default function EventPageLoader({ bundledAgenda }: { bundledAgenda: Agenda }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    const eventId = new URLSearchParams(window.location.search).get('id');
    if (!isValidEventId(eventId)) {
      setState({ kind: 'invalid' });
      return;
    }

    if (eventId === CONTAINERS_DAY_EVENT_ID) {
      upsertEvent(bundledAgenda.event);
      const agenda = reconcileBundledAgenda(loadAgendaCache(eventId), bundledAgenda);
      saveAgendaCache(eventId, agenda);
      setState({ kind: 'ready', agenda });
      return;
    }

    const cached = loadAgendaCache(eventId);
    setState(cached ? { kind: 'ready', agenda: cached } : { kind: 'missing' });
  }, [bundledAgenda]);

  if (state.kind === 'ready') {
    return <AgendaApp eventId={state.agenda.event.id} agenda={state.agenda} />;
  }

  const title =
    state.kind === 'loading'
      ? 'Cargando agenda…'
      : state.kind === 'invalid'
        ? 'El enlace del evento no es válido'
        : 'No encontramos este evento';
  const description =
    state.kind === 'invalid'
      ? 'Revisa el enlace o vuelve a tus eventos guardados.'
      : state.kind === 'missing'
        ? 'Puede que se haya eliminado de este dispositivo.'
        : null;

  return (
    <main id="main-content" className="event-state">
      <div className="event-state__card" role={state.kind === 'loading' ? 'status' : undefined}>
        <span className="event-state__icon" aria-hidden="true">
          {state.kind === 'loading' ? '◌' : '◇'}
        </span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {state.kind !== 'loading' ? (
          <Link className="home__primary" href="/">
            Volver a Mis eventos
          </Link>
        ) : null}
      </div>
    </main>
  );
}
