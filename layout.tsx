import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Müşteri Kayıt Portalı',
  description: 'Güvenli dijital müşteri bilgi formu',
  robots: { index: false, follow: false },
  icons: { icon: '/brand/zekra-logo.png', apple: '/brand/zekra-logo.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F3EDE2' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
