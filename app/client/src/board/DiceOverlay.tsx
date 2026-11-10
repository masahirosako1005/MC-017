// さいころの全画面表示（R-023、SC-05 §12 #7）。盤・ヘッダー・下のメニューの上に重ね、右から転がり込み、数回弾みながら
// だんだん遅くなって目を止める。サーバーの目が来るまでは ゆっくり回して待つ。「とばす」「すすむ」と Escape で先へ進める。
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useT } from '../i18n/index.ts';

const PIPS: Readonly<Record<number, readonly number[]>> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const FACES = [1, 2, 3, 4, 5, 6] as const;
/** 目ごとの止まる向き（少し斜めから見る）。面の対は 1-6・2-5・3-4 */
const REST: Readonly<Record<number, readonly [number, number]>> = { 1: [-14, 14], 6: [-14, 194], 3: [-14, -76], 4: [-14, 104], 2: [-104, 14], 5: [76, 14] };
const EASE = 'cubic-bezier(.12,.62,.2,1)';
/** 弾みの高さ（px）と時刻（0〜1）。落ちてきて、だんだん低く */
const BOUNCE_AT = [0, 0.22, 0.38, 0.52, 0.64, 0.74, 0.82, 0.9, 1] as const;
const BOUNCE_Y = [-170, 0, -62, 0, -26, 0, -9, 0, 0] as const;

export function restTransform(face: number): string {
  const [x, y] = REST[face] ?? [-14, 14];
  return `rotateX(${x}deg) rotateY(${y}deg)`;
}

interface Props {
  /** 何回目に振ったか。変わると さいころの絵を作り直す */
  seq: number;
  open: boolean;
  /** サーバーが決めた目。届くまでは null */
  face: number | null;
  /** 止まったか */
  landed: boolean;
  /** 進むマス数（ゴールで止まる分を引いた数） */
  moves: number;
  /** true なら回さず、止まった絵だけ出す（動きを減らす設定・「とばす」） */
  instant: boolean;
  /** 転がる時間（ミリ秒） */
  duration: number;
  onSkip: () => void;
}

export function DiceOverlay({ seq, open, face, landed, moves, instant, duration, onSkip }: Props) {
  const { t } = useT();
  const cube = useRef<HTMLDivElement>(null);
  const roller = useRef<HTMLDivElement>(null);
  const hop = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const skip = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) skip.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || face === null || instant || !cube.current || !roller.current || !hop.current || !shadow.current) return undefined;
    const [rx, ry] = REST[face] ?? [-14, 14];
    const anims = [
      cube.current.animate(
        [{ transform: 'rotateX(0deg) rotateY(0deg)' }, { transform: `rotateX(${rx + 720}deg) rotateY(${ry + 1080}deg)` }],
        { duration, easing: EASE, fill: 'both' },
      ),
      roller.current.animate([{ transform: 'translateX(170px)' }, { transform: 'translateX(0)' }], { duration, easing: EASE, fill: 'both' }),
      hop.current.animate(
        BOUNCE_AT.map((offset, i) => ({ offset, transform: `translateY(${BOUNCE_Y[i] ?? 0}px)`, easing: i % 2 === 0 ? 'ease-in' : 'ease-out' })),
        { duration, fill: 'both' },
      ),
      shadow.current.animate(
        BOUNCE_AT.map((offset, i) => {
          const high = Math.min(1, Math.max(0, -(BOUNCE_Y[i] ?? 0) / 170));
          return { offset, transform: `scale(${1 - high * 0.55})`, opacity: 0.45 - high * 0.3 };
        }),
        { duration, fill: 'both' },
      ),
    ];
    return () => anims.forEach((a) => a.cancel());
  }, [seq, open, face, instant, duration]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Tab') {
      e.preventDefault();
      skip.current?.focus();
    } else if (e.key === 'Escape') {
      onSkip();
    }
  }

  const rest = face !== null && (landed || instant) ? restTransform(face) : undefined;
  return (
    <div className={`xd-ov${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label={t('diceDialog')} aria-hidden={open ? undefined : 'true'}
      data-testid="dice-overlay" onKeyDown={onKeyDown}>
      <p className="xd-plate" data-testid="dice-title">{landed && face !== null ? t('diceLanded', { n: face }) : t('rolling')}</p>
      <div className="xd-stage">
        <div className="xd-floor" />
        <div className="xd-roller" key={seq} ref={roller}>
          <div className="xd-shadow" ref={shadow} />
          <div className="xd-hop" ref={hop}>
            <div className={`xd-scene${landed ? ' landed' : ''}`}>
              <div ref={cube} className={`xd-cube${face === null ? ' wait' : ''}`} style={rest ? { transform: rest } : undefined}
                role="img" aria-label={landed && face !== null ? t('diceFace', { n: face }) : t('diceDialog')}
                data-testid="dice-big" data-face={face ?? ''} data-landed={landed ? '1' : '0'}>
                {FACES.map((f) => (
                  <div key={f} className={`xd-face xf${f}`} aria-hidden="true">
                    {Array.from({ length: 9 }, (_, i) => <i key={i} className={(PIPS[f] ?? []).includes(i) ? 'on' : undefined} />)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="xd-plate" aria-hidden="true">{landed ? t('diceMoves', { n: moves }) : t('diceWait')}</p>
      <button type="button" ref={skip} className="xd-skip" data-testid="dice-skip" onClick={onSkip}>{landed ? t('diceGo') : t('diceSkip')}</button>
      <p className="sr-only" role="status" aria-live="polite">{landed && face !== null ? t('diceHeard', { n: face, m: moves }) : ''}</p>
    </div>
  );
}
