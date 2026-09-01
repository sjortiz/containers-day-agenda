'use client';

import { useEffect, useState } from 'react';
import type { Agenda } from '@/types';
import { listEvents, loadAgendaCache, saveAgendaCache, upsertEvent } from '@/lib/storage';
import EventCard from './EventCard';
import AddEventPanel from './AddEventPanel';

export default function EventLibrary({ bundledAgenda }: { bundledAgenda: Agenda }) {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const bundledId = bundledAgenda.event.id;
    upsertEvent(bundledAgenda.event);
    if (!loadAgendaCache(bundledId)) saveAgendaCache(bundledId, bundledAgenda);

    const available = listEvents().flatMap((event) => {
      const agenda = loadAgendaCache(event.id);
      if (agenda) return [agenda];
      return event.id === bundledId ? [bundledAgenda] : [];
    });
    setAgendas(available);
    setHydrated(true);
  }, [bundledAgenda]);

  const handleImported = (agenda: Agenda) => {
    setAgendas((current) => {
      const exists = current.some((item) => item.event.id === agenda.event.id);
      return exists
        ? current.map((item) => (item.event.id === agenda.event.id ? agenda : item))
        : [...current, agenda];
    });
  };

  return (
    <main id="main-content" className="home-shell">
      <header className="home-hero">
        <p className="home-hero__eyebrow">Tu agenda de eventos</p>
        <h1>Elige dónde quieres estar</h1>
        <p className="home-hero__intro">
          Guarda tus eventos, marca las charlas que te interesan y recibe avisos
          antes de que comiencen.
        </p>
        <AddEventPanel onImported={handleImported} />
      </header>

      <section className="event-library" aria-labelledby="event-library-title">
        <div className="event-library__heading">
          <div>
            <p className="event-library__label">Guardados en este dispositivo</p>
            <h2 id="event-library-title">Mis eventos</h2>
          </div>
          {hydrated ? (
            <span className="event-library__count">
              {agendas.length} {agendas.length === 1 ? 'evento' : 'eventos'}
            </span>
          ) : null}
        </div>

        {!hydrated ? (
          <p className="home-status" role="status">
            Cargando eventos…
          </p>
        ) : agendas.length === 0 ? (
          <div className="home-empty">
            <h3>Aún no tienes eventos</h3>
            <p>Agrega una agenda para empezar a elegir charlas.</p>
          </div>
        ) : (
          <div className="event-grid">
            {agendas.map((agenda) => (
              <EventCard key={agenda.event.id} agenda={agenda} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
