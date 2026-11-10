import type { Pair } from './spots.ts';

export const AVATAR_IDS = ['tomonyan', 'hoshirou', 'pikkon', 'toujii'] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];
export const DEFAULT_AVATAR: AvatarId = 'tomonyan';

export const EXPRESSIONS = ['happy', 'excited'] as const;
export type Expression = (typeof EXPRESSIONS)[number];
export const AVATAR_FILES = ['happy', 'happy-talk', 'excited', 'excited-talk'] as const;

export const AVATAR_NAMES: Readonly<Record<AvatarId, Pair>> = {
  tomonyan: ['ともにゃん', 'Tomonyan'],
  hoshirou: ['ほしろう', 'Hoshirou'],
  pikkon: ['ぴっこん', 'Pikkon'],
  toujii: ['とうじい', 'Toujii'],
};

export const EXPRESSION_NAMES: Readonly<Record<Expression, Pair>> = {
  happy: ['にこにこ', 'happy'],
  excited: ['わくわく', 'excited'],
};

/** VOICEVOX の話者（音声合成の準備.md §3.3 で確認済み）。サーバーだけが使う */
export const VOICEVOX_SPEAKERS: Readonly<Record<AvatarId, { id: number; credit: string; speedScale: number }>> = {
  tomonyan: { id: 8, credit: 'VOICEVOX:春日部つむぎ', speedScale: 1.1 },
  hoshirou: { id: 70, credit: 'VOICEVOX:満別花丸', speedScale: 1.0 },
  pikkon: { id: 54, credit: 'VOICEVOX:春歌ナナ', speedScale: 1.0 },
  toujii: { id: 42, credit: 'VOICEVOX:ちび式じい', speedScale: 1.0 },
};

export function avatarSrc(id: AvatarId, file: (typeof AVATAR_FILES)[number]): string {
  return `/avatars/${id}-${file}.svg`;
}
