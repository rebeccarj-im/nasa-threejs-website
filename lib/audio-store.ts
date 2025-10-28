// lib/audio-store.ts
'use client';
import { create } from 'zustand';

type AudioState = {
  enabled: boolean;
  volume: number;
  isReady: boolean;
  playNonce: number;
  markReady: () => void;
  setEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  kick: () => void;
};

export const useAudioStore = create<AudioState>((set, get) => ({
  enabled: false,
  volume: 0.5,
  isReady: false,
  playNonce: 0,
  markReady: () => set({ isReady: true }),
  setEnabled: (v) => set({ enabled: v }),
  setVolume: (v) => set({ volume: v }),
  kick: () => set({ playNonce: get().playNonce + 1 }),
}));
