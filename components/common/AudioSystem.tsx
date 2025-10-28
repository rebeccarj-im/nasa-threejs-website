// components/common/AudioSystem.tsx
'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useAudioStore } from '@/lib/audio-store';

type Props = {
  src: string;     // Background music file path, e.g. /audio/space-ambience.mp3
  loop?: boolean;  // Default true
};

export default function AudioSystem({ src, loop = true }: Props) {
  const { camera, scene } = useThree();
  const { enabled, volume, isReady } = useAudioStore();
  const listenerRef = useRef<THREE.AudioListener>();
  const audioRef = useRef<THREE.Audio>();

  // Mount / unmount the AudioListener
  useEffect(() => {
    const listener = new THREE.AudioListener();
    listenerRef.current = listener;
    camera.add(listener);
    return () => {
      camera.remove(listener);
      listenerRef.current = undefined;
    };
  }, [camera]);

  // Load and control background music
  useEffect(() => {
    if (!listenerRef.current || !isReady) return;

    const audio = new THREE.Audio(listenerRef.current);
    audioRef.current = audio;

    const loader = new THREE.AudioLoader();
    let disposed = false;

    loader.load(
      src,
      (buffer) => {
        if (disposed) return;
        audio.setBuffer(buffer);
        audio.setLoop(loop);
        audio.setVolume(volume);
        if (enabled) audio.play();
      },
      undefined,
      () => {
        // Ignore load failures; do not block the main process
      }
    );

    // Cleanup
    return () => {
      disposed = true;
      try {
        if (audio.isPlaying) audio.stop();
      } catch {}
      audioRef.current = undefined;
    };
  }, [src, loop, isReady]);

  // React to global state changes (toggle / volume)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.setVolume(volume);
    if (enabled && !audio.isPlaying) {
      try { audio.play(); } catch {}
    } else if (!enabled && audio.isPlaying) {
      audio.stop();
    }
  }, [enabled, volume]);

  // Optional: add a “virtual sound source” in the scene for positional audio demo (hidden when disabled)
  useEffect(() => {
    if (!enabled) return;
    // For example, add a tiny invisible helper at the scene center
    const g = new THREE.SphereGeometry(0.001);
    const m = new THREE.MeshBasicMaterial({ visible: false });
    const mesh = new THREE.Mesh(g, m);
    scene.add(mesh);
    return () => {
      scene.remove(mesh);
      g.dispose();
      m.dispose();
    };
  }, [enabled, scene]);

  return null;
}
