// 吹き出しのセリフを、ボタンを出さずにそのまま読み上げる（2026-11-10 指示）。画面に何も描かない。
// 読み上げは設定の「読み上げ」がオンのときだけ。止めるのは設定でオフにするか、別の画面へ移ったとき（speak が前の声を止める）。
import { useEffect } from 'react';
import type { AvatarId } from '../../../shared/master/avatars.ts';
import { useApp } from '../app-context.ts';
import { useT } from '../i18n/index.ts';
import { getSettings } from '../settings.ts';
import { speak, stopSpeech } from '../voice/speech.ts';

export function SpeakButton({ text, avatar }: { text: string; avatar: AvatarId; size?: number }) {
  const { toast } = useApp();
  const { t } = useT();
  useEffect(() => {
    if (!getSettings().speech) return undefined;
    void speak(text, avatar).then((ok) => { if (!ok) toast(t(getSettings().voice === 'auto' ? 'noVoicevox' : 'noVoice')); });
    return () => stopSpeech();
    // toast と t は毎回変わりうるが、読み直しはセリフか話者が変わったときだけにする
  }, [text, avatar]);
  return null;
}
