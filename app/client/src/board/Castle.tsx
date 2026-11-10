// 名古屋城のイラスト（SC-05 §12）。石垣・5層の屋根・金のしゃちほこ・小天守。絵だけなので aria-hidden の盤の SVG の中に置く。
import { useT } from '../i18n/index.ts';

const WALL = { fill: '#FFFDF6', stroke: '#CFC8B8', strokeWidth: 1.5 } as const;
const ROOF = { fill: '#5FAF98', stroke: '#3E8470', strokeWidth: 1.5 } as const;
const GOLD = { fill: '#F4B43A', stroke: '#C98A12', strokeWidth: 1 } as const;
const WINDOWS: readonly [number, number, number, number][] = [
  [68, 130, 8, 10], [92, 130, 8, 10], [116, 130, 8, 10], [140, 130, 8, 10], [80, 94, 7, 7], [103, 94, 7, 7], [126, 94, 7, 7],
  [94, 66, 6, 6], [114, 66, 6, 6], [103, 41, 7, 6], [26, 134, 8, 10],
];

export function Castle() {
  const { t } = useT();
  return (
    <>
      <g transform="translate(10 624)" data-testid="castle">
        <path d="M4 190L166 190L154 150L16 150Z" fill="#C5CCCF" stroke="#98A2A6" strokeWidth={1.5} />
        <path d="M12 170H158M8 182H162M50 150v20M92 150v20M130 150v20M30 170v12M72 170v12M112 170v12M146 170v12" stroke="#98A2A6" strokeWidth={1.2} />
        <rect x={10} y={126} width={40} height={24} {...WALL} />
        <path d="M0 128Q30 120 58 128L48 110H12Z" {...ROOF} />
        <rect x={58} y={120} width={98} height={30} {...WALL} />
        <path d="M46 122Q107 112 168 122L152 104H62Z" {...ROOF} />
        <rect x={68} y={90} width={78} height={14} {...WALL} />
        <path d="M56 92Q107 84 158 92L144 76H70Z" {...ROOF} />
        <rect x={78} y={62} width={58} height={14} {...WALL} />
        <path d="M66 64Q107 56 148 64L136 50H78Z" {...ROOF} />
        <rect x={88} y={38} width={38} height={12} {...WALL} />
        <path d="M74 40Q107 32 140 40L122 20H92Z" {...ROOF} />
        <path d="M92 20H122" stroke="#F4B43A" strokeWidth={3} strokeLinecap="round" />
        <path d="M91 21c-7-3-9-12-4-18c0 5 3 8 8 9z" {...GOLD} />
        <path d="M123 21c7-3 9-12 4-18c0 5-3 8-8 9z" {...GOLD} />
        <g fill="#5B6F73">{WINDOWS.map(([x, y, w, h]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={1} />)}</g>
        <rect x={94} y={168} width={26} height={22} rx={4} fill="#8A6A44" />
      </g>
      <g transform="translate(212 780)">
        <rect width={128} height={34} rx={10} fill="#8A6A44" stroke="#5E4529" strokeWidth={2} />
        <text x={64} y={24} textAnchor="middle" fontSize={17} fontWeight={800} fill="#fff" fontFamily="inherit">{t('castleName')}</text>
      </g>
    </>
  );
}

