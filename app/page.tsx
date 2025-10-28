// app/page.tsx
import dynamic from 'next/dynamic';

export const metadata = { title: 'Home' };

const ThreeCards = dynamic(() => import('@/components/three/ThreeCards'), { ssr: false });

export default function HomePage() {
  return (
    <section className="relative h-full overflow-hidden bg-black">
      <ThreeCards />
    </section>
  );
}
