// 画面の移動・利用者の状態・お知らせを各画面へ渡す。
import { createContext, useContext } from 'react';
import type { MeState } from '../../shared/schemas.ts';
import type { SpotId } from '../../shared/master/spots.ts';

export const TABS = ['home', 'spots', 'play', 'rumor', 'perks'] as const;
export type Tab = (typeof TABS)[number];
export type Screen = Tab | 'settings' | 'avatar' | 'detail' | 'qr' | 'note' | 'invite' | 'prophecy';

export interface AppApi {
  me: MeState;
  demoMode: boolean;
  screen: Screen;
  spotId: SpotId;
  /** replace: 今の画面を履歴に残さずに移る（QR の読み取り → 答え合わせ） */
  go: (screen: Screen, spotId?: SpotId, replace?: boolean) => void;
  back: () => void;
  setMe: (me: MeState) => void;
  refresh: () => Promise<void>;
  toast: (msg: string) => void;
  /** API の失敗を画面に出す（原因と「もう一度」） */
  fail: (err: unknown, retry?: () => void) => void;
}

export const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppContext missing');
  return v;
}

export function isTab(s: Screen): s is Tab {
  return (TABS as readonly string[]).includes(s);
}
