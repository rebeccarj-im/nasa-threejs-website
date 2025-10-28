'use client';
import { useEffect, useRef } from 'react';
import { useAudioStore } from '@/lib/audio-store';

/**
 * Reliable global background music (BGM) player:
 * - Uses a fallback <audio> element for basic playback (loop/inline)
 * - When available, connects the <audio> element to the Web Audio API
 *   for volume control via GainNode (and supports iOS silent switch scenarios)
 */
export default function AmbientAudio({ src, loop = true }: { src: string; loop?: boolean }) {
  const { enabled, volume, isReady, playNonce } = useAudioStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const mediaSrcRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Create the <audio> element (only once)
  useEffect(() => {
    const el = document.createElement('audio');
    el.src = src;
    el.loop = loop;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.setAttribute('playsinline', 'true'); // iOS Safari
    el.style.display = 'none';
    document.body.appendChild(el);
    audioRef.current = el;

    const onError = () => console.warn('[AmbientAudio] audio load error');
    el.addEventListener('error', onError);

    return () => {
      el.removeEventListener('error', onError);
      try { el.pause(); } catch {}
      el.src = '';
      el.remove();
      audioRef.current = null;
    };
  }, [src, loop]);

  // Initialize Web Audio pipeline (once ready)
  useEffect(() => {
    if (!isReady || !audioRef.current || ctxRef.current) return;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return; // Old devices without Web Audio — fallback to plain <audio>
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = volume;
      const media = ctx.createMediaElementSource(audioRef.current);
      media.connect(gain);
      gain.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = gain;
      mediaSrcRef.current = media;
    } catch (e) {
      // Ignore and continue using <audio> playback
    }
    return () => {
      try { mediaSrcRef.current?.disconnect(); } catch {}
      try { gainRef.current?.disconnect(); } catch {}
      try { ctxRef.current?.close(); } catch {}
      mediaSrcRef.current = null;
      gainRef.current = null;
      ctxRef.current = null;
    };
  }, [isReady]);

  // Handle volume changes (prefer Web Audio gain, fallback to <audio>.volume)
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Control play/pause based on enabled/nonce
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const playNow = async () => {
      // Some browsers require resume() before playback
      try { await ctxRef.current?.resume(); } catch {}
      try {
        await el.play();
      } catch (err) {
        // Silently ignore — may be blocked by user interaction or autoplay policy
        // console.debug('[AmbientAudio] play blocked', err);
      }
    };

    if (enabled) {
      playNow();
    } else {
      try { el.pause(); } catch {}
      el.currentTime = 0;
    }
  }, [enabled, playNonce]); // Clicking the play button changes nonce to retry playback

  // Automatically resume playback when page becomes visible again (after being backgrounded)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && enabled) {
        useAudioStore.getState().kick();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [enabled]);

  return null;
}
