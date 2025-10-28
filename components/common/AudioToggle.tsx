'use client';
import { useEffect, useRef } from 'react';
import { useAudioStore } from '@/lib/audio-store';

type Props = { compact?: boolean };

export default function AudioToggle({ compact }: Props) {
  const { enabled, setEnabled, isReady, markReady, kick } = useAudioStore();
  const unlocking = useRef(false);

  // When clicked: unlock audio, toggle state, and trigger playback immediately
  const onClick = async () => {
    if (!isReady && !unlocking.current) {
      unlocking.current = true;
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
      } finally {
        unlocking.current = false;
      }
    }
    setEnabled(!enabled);
    kick(); // Notify the player to attempt playback immediately
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={enabled}
      title={enabled ? 'Disable spatial audio' : 'Enable spatial audio'}
      className={`group inline-flex items-center gap-2 rounded-md border text-sm transition
        focus:outline-none focus:ring-2 focus:ring-sky-400/40
        ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}
        ${
          enabled
            ? // Enabled: light blue text, faint blue border, and semi-transparent background
              'border-sky-400/60 bg-sky-400/10 text-sky-300 hover:bg-sky-400/15'
            : // Disabled: gray text, translucent white border, brightens on hover
              'border-white/15 text-gray-300 hover:bg-white/10 hover:text-white'
        }`}
    >
      <svg
        width={compact ? 16 : 18}
        height={compact ? 16 : 18}
        viewBox="0 0 24 24"
        fill="none"
        className="transition-opacity"
        aria-hidden="true"
      >
        <path d="M4 9v6h4l5 4V5L8 9H4z" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M16.5 8.5a4 4 0 010 7M18.5 6a7 7 0 010 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {!compact && (
        <span className="whitespace-nowrap">
          {enabled ? 'Audio On' : 'Audio Off'}
        </span>
      )}
    </button>
  );
}
