// BGM：タイトル・本陣・戦・勝ち・負けの5曲（public/assets/sounds/bgm の mp3。無ければ鳴らさない）
import { useEffect } from 'react';

const V = '20261015';
export type Track = 'title' | 'map' | 'battle' | 'victory' | 'defeat';

export function trackUrl(t: Track): string {
  return `/assets/sounds/bgm/${t}.mp3?v=${V}`;
}

let current: HTMLAudioElement | null = null;
let currentSrc = '';
let volume = 0.5;
let pending: (() => void) | null = null;

export function setBgmVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (current) current.volume = volume;
  if (volume <= 0 && current) current.pause();
}

function clearPending() {
  if (!pending) return;
  window.removeEventListener('pointerdown', pending);
  window.removeEventListener('keydown', pending);
  pending = null;
}

/** 曲を切り替える（同じ曲なら何もしない） */
export function playBgm(src: string | null) {
  if (src === currentSrc && current && !current.paused) return;
  if (current && src !== currentSrc) {
    current.pause();
    current = null;
  }
  currentSrc = src ?? '';
  clearPending();
  if (!src || volume <= 0) return;
  if (!current) {
    current = new Audio(src);
    current.loop = !src.includes('victory') && !src.includes('defeat');
    current.preload = 'auto';
  }
  current.volume = volume;
  const audio = current;
  audio.play().catch(() => {
    // 自動再生が止められた時は、最初に触れた時に鳴らす
    pending = () => {
      clearPending();
      if (audio === current) audio.play().catch(() => undefined);
    };
    window.addEventListener('pointerdown', pending, { once: true });
    window.addEventListener('keydown', pending, { once: true });
  });
}

export function useBgm(src: string | null, vol: number) {
  useEffect(() => {
    setBgmVolume(vol);
  }, [vol]);
  useEffect(() => {
    playBgm(src);
  }, [src, vol]);
}
