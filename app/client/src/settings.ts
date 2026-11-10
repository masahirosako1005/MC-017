// 設定（R-035〜R-037）。端末内の localStorage にだけ置く。
import { useSyncExternalStore } from 'react';

export type Lang = 'ja' | 'en';
export type Size = 's' | 'm' | 'l';
export type VoiceMode = 'auto' | 'browser';

export interface Settings {
  lang: Lang;
  size: Size;
  speech: boolean;
  sfx: boolean;
  voice: VoiceMode;
}

const KEY = 'mc017.settings';
const DEFAULTS: Settings = { lang: 'ja', size: 'm', speech: true, sfx: true, voice: 'auto' };
export const FONT_SIZES: Readonly<Record<Size, string>> = { s: '15px', m: '17px', l: '20px' };

function load(): Settings {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null) return DEFAULTS;
    const r = raw as Record<string, unknown>;
    return {
      lang: r.lang === 'en' ? 'en' : 'ja',
      size: r.size === 's' || r.size === 'l' ? r.size : 'm',
      speech: r.speech !== false,
      sfx: r.sfx !== false,
      voice: r.voice === 'browser' ? 'browser' : 'auto',
    };
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // 保存できなくても、この表示の間は反映する
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings);
}
