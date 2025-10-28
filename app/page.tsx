// app/page.tsx
export const dynamic = 'force-dynamic'; 

import nextDynamic from 'next/dynamic';

export const metadata = { title: 'Home' };

const ThreeCards = nextDynamic(() => import('@/components/three/ThreeCards'), { ssr: false });

export default function HomePage() {
  return (
    <section className="relative h-full overflow-hidden bg-black">
      <ThreeCards />
    </section>
  );
}
