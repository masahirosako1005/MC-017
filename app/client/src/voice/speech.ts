// 読み上げ（R-037〜R-042、ADR-011、ADR-023）。声が「VOICEVOX」（既定）なら VOICEVOX（/api/tts）だけで読み、使えなければ文字だけ。設定で「ブラウザの声」を選んだときだけ端末内の声を使う。
import { useSyncExternalStore } from 'react';
import { VOICEVOX_SPEAKERS, type AvatarId } from '../../../shared/master/avatars.ts';
import { apiBlob } from '../api.ts';
import { getSettings, type Lang } from '../settings.ts';
import { pickVoice } from './voice-pick.ts';

export type Engine = 'voicevox' | 'browser' | 'none';
export interface SpeechState {
  speaking: boolean;
  /** 鳴っている声のクレジット（VOICEVOX のときだけ） */
  credit: string | null;
  /** 最後に使った声 */
  engine: Engine | null;
  browserVoice: string | null;
}

let state: SpeechState = { speaking: false, credit: null, engine: null, browserVoice: null };
const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let token = 0;

function set(patch: Partial<SpeechState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function cleanupAudio(): void {
  if (audio) {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio = null;
  }
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }
}

export function stopSpeech(): void {
  token += 1;
  cleanupAudio();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  set({ speaking: false, credit: null });
}

function browserVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  return pickVoice(window.speechSynthesis.getVoices(), lang);
}

/** 声の一覧は開いた直後は空のことがある。空なら voiceschanged を最大1秒待つ */
function voicesReady(): Promise<void> {
  if (!('speechSynthesis' in window) || window.speechSynthesis.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 1000);
    window.speechSynthesis.addEventListener('voiceschanged', done);
  });
}

function speakBrowser(text: string, lang: Lang, my: number): boolean {
  const v = browserVoice(lang);
  set({ browserVoice: v?.name ?? null });
  if (!v) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang;
  u.rate = 1.1;
  const done = () => {
    if (my === token) set({ speaking: false });
  };
  u.onend = done;
  u.onerror = done;
  window.speechSynthesis.cancel();
  set({ speaking: true, credit: null, engine: 'browser' });
  window.speechSynthesis.speak(u);
  return true;
}

async function speakVoicevox(text: string, avatar: AvatarId, my: number): Promise<boolean> {
  let blob: Blob;
  try {
    blob = await apiBlob('/tts', { avatarId: avatar, text });
  } catch {
    return false;
  }
  if (my !== token) return true;
  cleanupAudio();
  audioUrl = URL.createObjectURL(blob);
  const a = new Audio(audioUrl);
  audio = a;
  const done = () => {
    if (my !== token) return;
    cleanupAudio();
    set({ speaking: false, credit: null });
  };
  a.onended = done;
  a.onerror = done;
  set({ speaking: true, credit: VOICEVOX_SPEAKERS[avatar].credit, engine: 'voicevox' });
  try {
    await a.play();
  } catch (e: unknown) {
    // 操作の前の自動再生はブラウザが止めることがある（エンジンは動いている）。最初のタップ・キー操作で再生し、「起動していない」とは出さない
    if (e instanceof DOMException && e.name === 'NotAllowedError' && my === token) {
      const resume = () => {
        window.removeEventListener('pointerdown', resume, true);
        window.removeEventListener('keydown', resume, true);
        if (my === token && audio === a) a.play().catch(done);
      };
      window.addEventListener('pointerdown', resume, true);
      window.addEventListener('keydown', resume, true);
      return true;
    }
    done();
    return false;
  }
  return true;
}

/** 読み上げる。声が無いときは false（呼び出し側が「声がありません」を出す） */
export async function speak(text: string, avatar: AvatarId): Promise<boolean> {
  stopSpeech();
  const my = token;
  const { lang, voice } = getSettings();
  // 声が「VOICEVOX」のときは VOICEVOX だけで読む。使えなくてもブラウザの声へは切り替えず、呼び出し側が理由を出す（2026-11-09 指示、ADR-023）。
  // English でも VOICEVOX の声で読む【仮定】（話者は日本語向けなので、英語は聞き取りにくいことがある）
  if (voice === 'auto') {
    if (await speakVoicevox(text, avatar, my)) return true;
    if (my === token) set({ engine: 'none', browserVoice: null });
    return my !== token;
  }
  await voicesReady();
  if (my !== token) return true;
  if (speakBrowser(text, lang, my)) return true;
  set({ engine: 'none' });
  return false;
}

/**
 * 利用者の操作のあとのセリフを、吹き出しと同時に読む（方向性 §17.3）。読み上げ「なし」なら読まない。
 * 画面を開いただけのときは呼ばない。前のセリフは止める
 */
export function say(text: string, avatar: AvatarId): void {
  if (!getSettings().speech) return;
  void speak(text, avatar);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSpeech(): SpeechState {
  return useSyncExternalStore(subscribe, () => state);
}

/** 設定画面の「いまの声」用 */
export function currentBrowserVoiceName(lang: Lang): string | null {
  return browserVoice(lang)?.name ?? null;
}
