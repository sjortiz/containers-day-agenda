'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?(): Promise<string[]>;
}

function barcodeDetector(): BarcodeDetectorConstructor | null {
  return (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector ?? null;
}

export default function QrScanner({
  onDetected,
}: {
  onDetected: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  };

  useEffect(() => stop, []);

  const start = async () => {
    setError(null);
    const Detector = barcodeDetector();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite video en vivo. Usa “Tomar foto del QR” o pega el enlace.');
      return;
    }
    try {
      const supported = await Detector?.getSupportedFormats?.();
      const useNativeDetector = Boolean(Detector && (!supported || supported.includes('qr_code')));
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current;
      if (!video) return stop();
      video.srcObject = stream;
      await video.play();
      const detector = useNativeDetector && Detector
        ? new Detector({ formats: ['qr_code'] })
        : null;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          let value: string | undefined;
          if (detector) {
            const [code] = await detector.detect(videoRef.current);
            value = code?.rawValue;
          } else if (context && videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const videoWidth = videoRef.current.videoWidth;
            const videoHeight = videoRef.current.videoHeight;
            const scale = Math.min(1, 960 / Math.max(videoWidth, videoHeight));
            canvas.width = Math.max(1, Math.round(videoWidth * scale));
            canvas.height = Math.max(1, Math.round(videoHeight * scale));
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            value = jsQR(image.data, image.width, image.height, {
              inversionAttempts: 'attemptBoth',
            })?.data;
          }
          if (value) {
            stop();
            onDetected(value.trim());
            return;
          }
        } catch {
          // Algunos navegadores fallan mientras el primer frame aún no está listo.
        }
        frameRef.current = requestAnimationFrame(() => void scan());
      };
      void scan();
    } catch {
      stop();
      setError('No pudimos usar la cámara en vivo. Usa “Tomar foto del QR” o revisa el permiso de cámara.');
    }
  };

  const scanPhoto = async (file: File | undefined) => {
    if (!file) return;
    setReadingPhoto(true);
    setError(null);
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('image'));
        image.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('canvas');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const value = jsQR(pixels.data, pixels.width, pixels.height, {
        inversionAttempts: 'attemptBoth',
      })?.data;
      if (!value) {
        setError('No encontramos un QR legible en la foto. Acércate más e inténtalo de nuevo.');
        return;
      }
      onDetected(value.trim());
    } catch {
      setError('No pudimos leer esa imagen. Toma otra foto o pega el enlace manualmente.');
    } finally {
      URL.revokeObjectURL(objectUrl);
      setReadingPhoto(false);
    }
  };

  return (
    <div className="qr-scanner">
      <div className="qr-scanner__camera" hidden={!scanning}>
          <video ref={videoRef} muted playsInline
            aria-label="Vista de la cámara para escanear el código QR" />
          <p role="status">Apunta la cámara al código QR del evento.</p>
          <button type="button" className="qr-scanner__stop" onClick={stop}>Cancelar escaneo</button>
      </div>
      {!scanning ? (
        <div className="qr-scanner__actions">
          <button type="button" className="qr-scanner__start" onClick={() => void start()}>
            <span aria-hidden="true">▦</span> Escanear en vivo
          </button>
          <label className="qr-scanner__photo">
            <span aria-hidden="true">◉</span>{' '}
            {readingPhoto ? 'Leyendo foto…' : 'Tomar foto del QR'}
            <input type="file" accept="image/*" capture="environment"
              disabled={readingPhoto} onChange={(event) => {
                void scanPhoto(event.target.files?.[0]);
                event.target.value = '';
              }} />
          </label>
        </div>
      ) : null}
      {error ? <p className="qr-scanner__error" role="alert">{error}</p> : null}
    </div>
  );
}
