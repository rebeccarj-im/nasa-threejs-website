'use client';
import { useEffect, useRef } from 'react';
import { useAudioStore } from '@/lib/audio-store';

/** 
 * Listens for the user's first interaction gesture:
 * - Unlocks the Web Audio context (required by browsers)
 * - If `enabled === true`, automatically triggers playback
 */
export default function AudioBootstrap() {
  const { isReady, markReady, enabled, kick } = useAudioStore();
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;

    const handler = async () => {
      if (doneRef.current) return;
      doneRef.current = true;

      // Unlock Web Audio (if available)
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          await ctx.resume().catch(() => {});
          markReady();
          try { await ctx.close(); } catch {}
        } else {
          markReady();
        }
      } catch {
        // Ignore errors silently
      }

      // If the user’s preference is already enabled, start playback immediately
      if (enabled) kick();

      // Clean up event listeners
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('touchstart', handler);
    };

    // Register listeners only if audio is not yet initialized
    if (!isReady) {
      window.addEventListener('pointerdown', handler, { once: true });
      window.addEventListener('keydown', handler, { once: true });
      window.addEventListener('touchstart', handler, { once: true, passive: true });
    }

    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('touchstart', handler);
    };
  }, [isReady, markReady, enabled, kick]);

  return null;
}
