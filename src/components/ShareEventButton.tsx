'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { EventMeta } from '@/types';
import { eventShareUrl } from '@/lib/event-share';

export default function ShareEventButton({ event }: { event: EventMeta }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void QRCode.toDataURL(eventShareUrl(event.sourceUrl, event.name), {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0a0f1e', light: '#ffffff' },
    }).then(setQr).catch(() => setError(true));
  }, [event.sourceUrl]);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" className="event-card__share" onClick={open}>
        <span aria-hidden="true">▦</span> Compartir
      </button>
      <dialog ref={dialogRef} className="share-dialog" onClick={(click) => {
        if (click.target === dialogRef.current) close();
      }}>
        <div className="share-dialog__content">
          <button type="button" className="share-dialog__close" onClick={close}
            aria-label="Cerrar código QR"><span aria-hidden="true">×</span></button>
          <p className="share-dialog__eyebrow">Compartir evento</p>
          <h2>{event.name}</h2>
          <p>Tu amigo puede escanear este código desde “Agregar evento”.</p>
          {qr ? <img src={qr} width="320" height="320"
            alt={`Código QR para agregar ${event.name}`} /> : null}
          {error ? <p role="alert">No pudimos crear el código QR.</p> : null}
          <small>Solo contiene el enlace público de Sessionize.</small>
        </div>
      </dialog>
    </>
  );
}
