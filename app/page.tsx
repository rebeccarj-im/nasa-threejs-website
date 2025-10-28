// app/page.tsx
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import nextDynamic from 'next/dynamic';

export const metadata = { title: 'Home' };

// Client-only Three.js scene (no SSR)
const ThreeCards = nextDynamic(() => import('@/components/three/ThreeCards'), { ssr: false });

export default function HomePage() {
  return (
    <section className="relative h-full overflow-hidden bg-black">
      {/* Optional: Suspense gives a clean handoff while the client bundle loads */}
      <Suspense fallback={null}>
        <ThreeCards />
      </Suspense>
    </section>
  );
}
