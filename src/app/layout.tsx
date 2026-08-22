import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import { APP_NAME, APP_SHORT_NAME, withBase } from '@/config';

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    'Arma tu agenda personal de Containers Day y recibe un aviso 10 minutos antes de cada charla, con salón, título y speaker.',
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
  themeColor: '#0b1020',
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
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
