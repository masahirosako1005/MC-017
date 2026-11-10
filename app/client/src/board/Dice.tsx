// 立体のさいころ（R-023、SC-05 のモック）。CSS 3D の立方体。転がっている間は回り、止まるとサーバーの目の面が手前に来る。
import { useT } from '../i18n/index.ts';

const PIPS: Readonly<Record<number, readonly number[]>> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const FACES = [1, 2, 3, 4, 5, 6] as const;

export function Dice({ face, rolling }: { face: number; rolling: boolean }) {
  const { t } = useT();
  return (
    <div className="scene" data-testid="dice" role="img" aria-label={rolling ? t('rolling') : t('diceFace', { n: face })} data-face={face} data-rolling={rolling ? '1' : '0'}>
      <div className={`cube ${rolling ? 'rolling' : `show-${face}`}`} aria-hidden="true">
        {FACES.map((f) => (
          <div key={f} className={`face f${f}`}>
            {Array.from({ length: 9 }, (_, i) => <i key={i} className={(PIPS[f] ?? []).includes(i) ? 'on' : undefined} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
