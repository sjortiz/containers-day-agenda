'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Agenda } from '@/types';
import { fetchSessionizeAgenda, isSessionizeUrl } from '@/lib/sessionize';
import { saveAgendaCache, upsertEvent } from '@/lib/storage';

export default function AddEventPanel({ onImported }: { onImported: (agenda: Agenda) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (!isSessionizeUrl(url) || !/\/api\/v2\/[a-z0-9]+(?:\/|$)/i.test(new URL(url).pathname)) {
      setMessage('Pega un enlace API v2 de Sessionize válido.');
      return;
    }
    setBusy(true);
    const result = await fetchSessionizeAgenda(url);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.reason === 'network'
        ? 'No pudimos conectar con Sessionize. Revisa tu conexión e inténtalo de nuevo.'
        : 'Sessionize no devolvió una agenda compatible con ese enlace.');
      return;
    }
    const agenda = { ...result.agenda, event: { ...result.agenda.event, name: name.trim() } };
    upsertEvent(agenda.event);
    saveAgendaCache(agenda.event.id, agenda);
    onImported(agenda);
    router.push(`/event/?id=${encodeURIComponent(agenda.event.id)}`);
  };

  return (
    <section className="add-event">
      <button type="button" className="home__primary" aria-expanded={open}
        aria-controls="add-event-details" onClick={() => setOpen((current) => !current)}>
        <span aria-hidden="true">＋</span> Agregar evento
      </button>
      {open ? (
        <div id="add-event-details" className="add-event__panel">
          <div className="add-event__content">
            <h2>Agrega un evento de Sessionize</h2>
            <p>Pega el enlace API v2 que comparte el evento. La agenda se actualizará automáticamente en este dispositivo.</p>
            <form className="add-event__form" onSubmit={submit}>
              <label htmlFor="event-name">Nombre del evento</label>
              <input id="event-name" name="event-name" value={name}
                onChange={(event) => setName(event.target.value)} autoComplete="off"
                placeholder="Mi conferencia" required />
              <label htmlFor="agenda-url">Enlace API de Sessionize</label>
              <input id="agenda-url" name="agenda-url" type="url" inputMode="url"
                value={url} onChange={(event) => setUrl(event.target.value)} autoComplete="off"
                placeholder="https://sessionize.com/api/v2/…/view/GridSmart" required />
              <button type="submit" disabled={busy}>{busy ? 'Agregando…' : 'Agregar evento'}</button>
            </form>
            {message ? <p className="add-event__message" role="alert">{message}</p> : null}
          </div>
          <button type="button" className="add-event__close" aria-label="Cerrar formulario"
            onClick={() => setOpen(false)}><span aria-hidden="true">×</span></button>
        </div>
      ) : null}
    </section>
  );
}
