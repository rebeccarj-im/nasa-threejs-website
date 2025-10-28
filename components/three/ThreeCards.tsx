// components/three/ThreeCards.tsx
'use client';

import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRouter } from 'next/navigation';
import React, { Suspense, useMemo, useRef, useState, useEffect, Dispatch, SetStateAction } from 'react';
import {
  useTexture,
  OrbitControls,
  useCursor,
  Stars,
  Environment,
  RoundedBox,
  Html,
  useProgress,
  Preload,
} from '@react-three/drei';

type Vec3 = [number, number, number];

/* ───────────────── Loader (in-canvas widget) ───────────────── */
function CanvasLoader() {
  const { progress /* active, item */ } = useProgress();
  const pct = Math.min(100, Math.max(0, progress || 0)).toFixed(0);

  return (
    <Html center>
      <div className="flex flex-col items-center gap-3 rounded-lg bg-black/60 px-4 py-3 text-white shadow-lg ring-1 ring-white/10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        <div className="text-xs tracking-wide text-white/80">Loading… {pct}%</div>
      </div>
    </Html>
  );
}

/* ────────── Watch drei loading progress and notify parent when ready ───────── */
function ProgressWatcher({ onReady }: { onReady: (ready: boolean) => void }) {
  const { active } = useProgress();          // active=true means still loading
  useEffect(() => onReady(!active), [active, onReady]);
  return null;
}

/* ─────────────── Rounded-rectangle Shape (for the front texture) ─────────────── */
function createRoundedRectShape(width: number, height: number, radius: number) {
  const w = width, h = height, r = Math.min(radius, Math.min(w, h) / 2);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

/* ───── Responsive camera distance / global scale / horizontal spacing ───── */
function useResponsiveLayout() {
  const { size, camera } = useThree();
  const width = size.width;
  const t = THREE.MathUtils.clamp((1200 - width) / (1200 - 360), 0, 1);

  const baseZ = 6.3;
  const z = baseZ + THREE.MathUtils.lerp(0, 1.6, t);
  const scale = THREE.MathUtils.lerp(1.0, 0.85, t);
  const spacing = THREE.MathUtils.lerp(2.6, 1.8, t);

  useEffect(() => {
    (camera as THREE.PerspectiveCamera).position.set(0, 0, z);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [z, camera]);

  return { scale, spacing };
}

function Card({
  index,
  onHoverChange,
  href,
  label,              // not rendered in 3D; DOM only
  textureUrl,
  position,
  rotation,
  size = [1.9, 2.8] as [number, number],
  depth = 0.08,
  radius = 0.18,
  glassTint = '#0e1118',
}: {
  index: number;
  onHoverChange: Dispatch<SetStateAction<number | null>>;
  href: string;
  label: string;
  textureUrl: string;
  position: Vec3;
  rotation: Vec3;
  size?: [number, number];
  depth?: number;
  radius?: number;
  glassTint?: string;
}) {
  const router = useRouter();
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, 'pointer', 'auto');

  // drei's useTexture is suspense-aware, so it will trigger the fallback in <Suspense>
  const map = useTexture(textureUrl);
  map.anisotropy = 8;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;

  const initial = useMemo(
    () => ({
      position: new THREE.Vector3(...position),
      rotation: new THREE.Euler(...rotation),
      scale: 1,
    }),
    [position, rotation]
  );
  const target = useMemo(
    () => ({
      position: hovered
        ? new THREE.Vector3(position[0], position[1] + 0.08, position[2])
        : new THREE.Vector3(...position),
      rotation: hovered ? new THREE.Euler(0, 0, 0) : new THREE.Euler(...rotation),
      scale: hovered ? 1.06 : 1,
    }),
    [hovered, position, rotation]
  );

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const lambda = hovered ? 5 : 12;
    g.position.lerp(target.position, 1 - Math.exp(-lambda * dt));
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, target.rotation.x, lambda, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, target.rotation.y, lambda, dt);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, target.rotation.z, lambda, dt);
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, target.scale, lambda, dt));
  });

  const faceGeom = useMemo(
    () => new THREE.ShapeGeometry(createRoundedRectShape(size[0], size[1], radius), 64),
    [size, radius]
  );

  return (
    <group
      ref={groupRef}
      position={initial.position}
      rotation={initial.rotation}
      onPointerOver={() => {
        setHovered(true);
        onHoverChange(index);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHoverChange((prev) => (prev === index ? null : prev));
      }}
      onClick={() => router.push(href)}
    >
      {/* glassy rounded back plate */}
      <RoundedBox args={[size[0], size[1], depth]} radius={radius} smoothness={8}>
        <meshPhysicalMaterial
          color={glassTint}
          roughness={0.22}
          metalness={0.05}
          transmission={0.42}
          thickness={0.5}
          ior={1.4}
          clearcoat={1}
          clearcoatRoughness={0.08}
          transparent
          opacity={0.92}
        />
      </RoundedBox>

      {/* rounded face map (slightly forward to avoid z-fighting) */}
      <mesh position={[0, 0, depth / 2 + 0.0006]} geometry={faceGeom}>
        <meshStandardMaterial map={map} roughness={0.55} metalness={0} transparent opacity={0.95} />
      </mesh>
    </group>
  );
}

function CardsGroup({
  setHoveredIndex,
}: {
  setHoveredIndex: Dispatch<SetStateAction<number | null>>;
}) {
  const { scale, spacing } = useResponsiveLayout();

  const cards = useMemo(
    () => [
      {
        href: '/gallery/ring?lib=image',
        label: 'Image Library',
        textureUrl: '/textures/nebula.jpg',
        position: [-spacing, 0.08, 0] as Vec3,
        rotation: [
          THREE.MathUtils.degToRad(-15),
          THREE.MathUtils.degToRad(12),
          THREE.MathUtils.degToRad(-6),
        ] as Vec3,
      },
      {
        href: '/gallery/ring?lib=donki',
        label: 'DONKI',
        textureUrl: '/textures/sun.jpg',
        position: [0, -0.06, -0.2] as Vec3,
        rotation: [
          THREE.MathUtils.degToRad(-12),
          THREE.MathUtils.degToRad(-5),
          THREE.MathUtils.degToRad(3),
        ] as Vec3,
      },
      {
        href: '/gallery/ring?lib=neows',
        label: 'NeoWs',
        textureUrl: '/textures/asteroid.jpg',
        position: [spacing, 0.12, 0.1] as Vec3,
        rotation: [
          THREE.MathUtils.degToRad(1),
          THREE.MathUtils.degToRad(-3),
          THREE.MathUtils.degToRad(-2),
        ] as Vec3,
      },
    ],
    [spacing]
  );

  return (
    <group scale={[scale, scale, scale]}>
      {cards.map((c, i) => (
        <Card
          key={c.href}
          index={i}
          onHoverChange={setHoveredIndex}
          href={c.href}
          label={c.label}
          textureUrl={c.textureUrl}
          position={c.position}
          rotation={c.rotation}
        />
      ))}
    </group>
  );
}

export default function ThreeCards() {
  const dpr =
    typeof window !== 'undefined' && window.devicePixelRatio
      ? Math.min(2, window.devicePixelRatio)
      : 1;

  // Hoist hover state for DOM labels
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // Show the bottom hint only after assets are fully loaded
  const [ready, setReady] = useState(false);

  const labels = ['Image Library', 'DONKI', 'NeoWs'];

  return (
    <div className="relative h-full w-full bg-black">
      <Canvas
        className="absolute inset-0"
        dpr={dpr}
        camera={{ position: [0, 0, 6.3], fov: 45 }}
      >
        {/* Use Suspense so textures/environment can show a loader instead of a black screen */}
        <Suspense fallback={<CanvasLoader />}>
          {/* background + stars */}
          <color attach="background" args={['#000']} />
          <Stars radius={80} depth={50} count={1200} factor={2} saturation={0} fade speed={0.2} />
          <Environment preset="city" />

          {/* soft lighting (no shadows) */}
          <ambientLight intensity={0.95} />
          <directionalLight position={[4, 6, 8]} intensity={0.8} />
          <directionalLight position={[-6, -2, -6]} intensity={0.3} />

          <CardsGroup setHoveredIndex={setHoveredIndex} />

          {/* orbit controls */}
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 2.8}
            maxPolarAngle={Math.PI / 1.8}
            minAzimuthAngle={-Math.PI / 8}
            maxAzimuthAngle={Math.PI / 8}
          />

          {/* Watch loading state and notify parent when ready */}
          <ProgressWatcher onReady={setReady} />

          {/* Preload all assets referenced in the scene */}
          <Preload all />
        </Suspense>
      </Canvas>

      {/* DOM labels under each card (only the hovered one shows) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="
            grid w-[min(680px,86%)] grid-cols-3 items-start justify-items-center
            translate-y-[56px] md:translate-y-[64px]
            text-white/90
          "
        >
          {labels.map((text, i) => (
            <span
              key={text}
              className={`${
                hoveredIndex === i ? 'opacity-100' : 'opacity-0'
              } transition-opacity duration-150 text-xs md:text-sm`}
              style={{ textShadow: '0 0 6px rgba(0,0,0,0.6)' }}
            >
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom hint: only show after ready */}
      {ready && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 text-center">
          <span className="px-3 py-1 text-[18px] md:text-[16px] tracking-wide text-gray-200/80">
            ✨ Hover to choose your universe oracle card ✨
          </span>
        </div>
      )}
    </div>
  );
}
