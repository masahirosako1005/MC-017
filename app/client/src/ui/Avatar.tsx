// アバター（R-007、AC-009・AC-010）。同じオリジンの SVG を <img> で出し、読み上げ中は表情と talk を約0.15秒ごとに替える。
import { useEffect, useState } from 'react';
import { AVATAR_NAMES, EXPRESSION_NAMES, avatarSrc, type AvatarId, type Expression } from '../../../shared/master/avatars.ts';
import { useT } from '../i18n/index.ts';
import { useSpeech } from '../voice/speech.ts';

export const FLAP_MS = 150;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

interface Props {
  id: AvatarId;
  expression?: Expression;
  size: number;
  /** 読み上げに合わせて口を動かすか（吹き出しの横のアバターだけ true） */
  talk?: boolean;
  /** 盤の駒など、近くに同じ内容の文字があるときは alt を空にする */
  decorative?: boolean;
  className?: string;
}

export function Avatar({ id, expression = 'happy', size, talk = false, decorative = false, className }: Props) {
  const { L, lang } = useT();
  const { speaking } = useSpeech();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const flapping = talk && speaking && !reduced;

  useEffect(() => {
    if (!flapping) {
      setOpen(false);
      return undefined;
    }
    const timer = setInterval(() => setOpen((o) => !o), FLAP_MS);
    return () => clearInterval(timer);
  }, [flapping]);

  const name = L(AVATAR_NAMES[id]);
  const expr = L(EXPRESSION_NAMES[expression]);
  const alt = decorative ? '' : lang === 'en' ? `${name} (${expr})` : `${name}（${expr}）`;
  return (
    <span className={`avimg${className ? ` ${className}` : ''}`} data-mouth={open ? 'open' : 'closed'} data-avatar={id}>
      <img src={avatarSrc(id, expression)} alt={alt} width={size} height={size} draggable={false} />
      {talk && (
        <img className={`talk${open ? ' on' : ''}`} src={avatarSrc(id, `${expression}-talk`)} alt="" aria-hidden="true"
          width={size} height={size} draggable={false} />
      )}
    </span>
  );
}
