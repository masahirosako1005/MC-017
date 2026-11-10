// 文言の取り出し（R-035）。辞書は words-*.ts。
import { useCallback } from 'react';
import type { Pair } from '../../../shared/master/spots.ts';
import { useSettings, type Lang } from '../settings.ts';
import { COMMON } from './words-common.ts';
import { HOME_WORDS } from './words-home.ts';
import { PERKS_WORDS } from './words-perks.ts';
import { PLAY } from './words-play.ts';
import { PROPHECY_WORDS } from './words-prophecy.ts';
import { SHOP_WORDS } from './words-shop.ts';
import { SPOTS_WORDS } from './words-spots.ts';

export const WORD_SETS = { COMMON, PLAY, SPOTS_WORDS, PROPHECY_WORDS, PERKS_WORDS, HOME_WORDS, SHOP_WORDS } as const;
const WORDS = { ...COMMON, ...PLAY, ...SPOTS_WORDS, ...PROPHECY_WORDS, ...PERKS_WORDS, ...HOME_WORDS, ...SHOP_WORDS };
export type WordKey = keyof typeof WORDS;
export type Vars = Readonly<Record<string, string | number>>;

export function tr(lang: Lang, key: WordKey, vars?: Vars): string {
  const text: string = WORDS[key][lang === 'en' ? 1 : 0];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export function pick(lang: Lang, pair: Pair): string {
  return pair[lang === 'en' ? 1 : 0];
}

export type T = (key: WordKey, vars?: Vars) => string;

export function useT(): { t: T; L: (pair: Pair) => string; lang: Lang } {
  const { lang } = useSettings();
  const t = useCallback<T>((key, vars) => tr(lang, key, vars), [lang]);
  const L = useCallback((pair: Pair) => pick(lang, pair), [lang]);
  return { t, L, lang };
}
