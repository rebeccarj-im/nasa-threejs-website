// app/layout.tsx
import '../styles/globals.css';
import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';

import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

const AmbientAudio = dynamic(() => import('@/components/common/AmbientAudio'), { ssr: false });
const AudioBootstrap = dynamic(() => import('@/components/common/AudioBootstrap'), { ssr: false });

export const metadata: Metadata = {
  title: { default: 'Cosmos Oracle', template: '%s — Cosmos Oracle' },
  description:
    'Explore NASA Image Library, DONKI solar activity, and NeoWs near-earth objects with visual insights and easy sharing.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Cosmos Oracle' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
};

// ⛔ The Root Layout must be a server component
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      {/* Important: Do NOT add text or background color classes here, 
          as it may override the body styles defined in globals.css */}
      <body className="min-h-screen antialiased flex flex-col overflow-x-hidden">
        <Header />
        {/* The content area's colors are defined by each page/component.
            globals.css already provides default text-gray-900 and bg-gray-50. */}
        <main className="flex-1">{children}</main>
        <Footer />
        <AmbientAudio src="/audio/space-ambience.mp3" />
        <AudioBootstrap />
      </body>
    </html>
  );
}
