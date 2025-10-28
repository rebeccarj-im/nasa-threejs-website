// app/layout.tsx
import '../styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

// Client-only widgets (no SSR)
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

// ⛔ Keep this as a Server Component (no "use client" here)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      {/* Avoid setting text/background directly on <html>; globals.css handles base theming. */}
      <body className="min-h-screen antialiased flex flex-col overflow-x-hidden">
        {/* Header (Client Component) uses useSearchParams → place inside Suspense */}
        <Suspense fallback={null}>
          <Header />
        </Suspense>

        {/* Main app content. Wrapping children ensures any subtree using useSearchParams is within a boundary. */}
        <main className="flex-1">
          <Suspense fallback={null}>{children}</Suspense>
        </main>

        {/* Footer is typically static; leave as-is. If it ever uses router hooks, wrap with Suspense too. */}
        <Footer />

        {/* Client-only ambient audio bootstrapping (no need for Suspense here). */}
        <AmbientAudio src="/audio/space-ambience.mp3" />
        <AudioBootstrap />
      </body>
    </html>
  );
}
