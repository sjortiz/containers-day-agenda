import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import { APP_NAME, APP_SHORT_NAME, withBase } from '@/config';

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    'Guarda tus eventos, arma tu agenda personal y recibe avisos antes de cada charla.',
  applicationName: APP_SHORT_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_SHORT_NAME,
  },
  icons: {
    icon: withBase('/icons/icon-192.png'),
    apple: withBase('/icons/apple-touch-icon.png'),
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0f1e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#main-content">
          Saltar al contenido
        </a>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
