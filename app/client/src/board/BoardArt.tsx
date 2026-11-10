// 盤の背景の絵（SC-05 §12）。空・太陽・雲・虹・牧草地・川と橋・木・家・花・丘と、ゴールの名古屋城。
// 絵だけなので aria-hidden の盤の SVG の中に置く。2枚目は冬: 雪の空・もみじ・提灯・雪の結晶（C8）。
import { BOARD_H, BOARD_W, trailPath } from './geometry.ts';
import { Castle } from './Castle.tsx';

type Piece = 't' | 'h' | 'f';
const SIZE: Readonly<Record<Piece, readonly [number, number]>> = { t: [22, 26], h: [26, 22], f: [12, 12] };
/** 道と重ならない、段と段のすきまの飾り */
const DECO: readonly (readonly [Piece, number, number])[] = [
  ['t', 104, 116], ['t', 170, 118], ['h', 226, 118], ['h', 92, 220], ['t', 150, 218], ['f', 206, 226], ['f', 240, 230],
  ['t', 100, 324], ['t', 132, 326], ['h', 220, 326], ['f', 110, 432], ['f', 170, 436], ['f', 236, 430],
];
const RAINBOW = ['#FF9AA2', '#FFC48C', '#FFE69A', '#B8E6A8', '#9ED8F5', '#C3B1F0'] as const;
const CLOUDS: readonly (readonly [number, number, number])[] = [[120, 14, 64], [200, 44, 44], [20, 420, 56], [250, 330, 48]];

const SPRING = { sky: ['#BDE6FA', '#EAF7E8'], ground: '#EAF7E0', hill1: '#DDF1C8', hill2: '#D2EBBA', hill3: ['#C6E8AC', '#A9D78F'], hill4: '#9BCF82', river: '#BFE0EA' } as const;
const WINTER = { sky: ['#C9DCEB', '#EEF3F8'], ground: '#EEF4F8', hill1: '#E4EDF3', hill2: '#DAE6EE', hill3: ['#EAF1F6', '#D2E0EA'], hill4: '#CBDBE6', river: '#CFE6F2' } as const;

function Defs() {
  return (
    <defs>
      <symbol id="bd-t" viewBox="0 0 20 24"><rect x="8.5" y="15" width="3" height="8" rx="1" fill="#9C7A4E" /><circle cx="10" cy="10" r="8" fill="#8FCB86" /><circle cx="7" cy="8" r="3" fill="#B4DAA6" /></symbol>
      <symbol id="bd-h" viewBox="0 0 26 22"><path d="M2 11L13 2l11 9" fill="#E59A7E" /><rect x="5" y="10" width="16" height="11" rx="2" fill="#FFE9D2" stroke="#D9B48E" strokeWidth="1.2" /><rect x="11" y="14" width="4" height="7" fill="#C98A5E" /></symbol>
      <symbol id="bd-f" viewBox="0 0 12 12"><circle cx="6" cy="3" r="2.4" fill="#F7A8B8" /><circle cx="9" cy="6" r="2.4" fill="#F7A8B8" /><circle cx="6" cy="9" r="2.4" fill="#F7A8B8" /><circle cx="3" cy="6" r="2.4" fill="#F7A8B8" /><circle cx="6" cy="6" r="1.8" fill="#F4B43A" /></symbol>
      <symbol id="bd-wt" viewBox="0 0 20 24"><polygon points="10,-1 11.8,7 19,6 13.6,12 18,21 10,17 2,21 6.4,12 1,6 8.2,7" transform="translate(0 2)" fill="#D2402A" /></symbol>
      <symbol id="bd-wh" viewBox="0 0 26 22"><rect x="12" y="1" width="2" height="3" fill="#3B2A00" /><ellipse cx="13" cy="12" rx="8" ry="9" fill="#E2553C" /><path d="M5 12h16M6 7h14M6 17h14" stroke="#F8C9A0" strokeWidth="1.2" /></symbol>
      <symbol id="bd-wf" viewBox="0 0 12 12"><path d="M6 1v10M1.5 3.5l9 5M1.5 8.5l9-5" stroke="#7FB3D5" strokeWidth="1.4" strokeLinecap="round" /></symbol>
      <symbol id="bd-c" viewBox="0 0 60 26"><path d="M14 24a10 10 0 0 1 0-20a14 14 0 0 1 26-2a12 12 0 0 1 8 22z" fill="#fff" stroke="#E6EEF0" strokeWidth="1.5" /></symbol>
    </defs>
  );
}

export function BoardArt({ winter }: { winter: boolean }) {
  const c = winter ? WINTER : SPRING;
  const trail = trailPath();
  return (
    <>
      <Defs />
      <linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.sky[0]} /><stop offset="1" stopColor={c.sky[1]} /></linearGradient>
      <linearGradient id="bd-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.hill3[0]} /><stop offset="1" stopColor={c.hill3[1]} /></linearGradient>
      <rect width={BOARD_W} height={BOARD_H} fill={c.ground} />
      <rect width={BOARD_W} height={470} fill="url(#bd-sky)" />
      {winter ? null : (
        <>
          <circle cx={314} cy={34} r={18} fill="#FFD66B" />
          <path d="M314 8v-4M314 60v-4M288 34h-4M344 34h-4M296 16l-3-3M332 16l3-3M296 52l-3 3M332 52l3 3" stroke="#FFD66B" strokeWidth={2.5} strokeLinecap="round" />
          <g fill="none" strokeWidth={8} opacity={0.6}>
            {RAINBOW.map((col, i) => <path key={col} d={`M${30 + i * 8} 400A${150 - i * 8} ${150 - i * 8} 0 0 1 ${330 - i * 8} 400`} stroke={col} />)}
          </g>
        </>
      )}
      {CLOUDS.map(([x, y, w]) => <use key={`${x}-${y}`} href="#bd-c" x={x} y={y} width={w} height={w * 0.43} />)}
      <path d={`M0 470C60 450 120 480 180 464S300 450 360 470V${BOARD_H}H0Z`} fill={c.hill1} />
      <path d={`M0 700C70 684 140 712 210 698S320 684 360 700V${BOARD_H}H0Z`} fill={c.hill2} />
      <path d="M0 540C50 528 100 552 160 542S270 530 360 544V566C300 576 240 560 180 568S60 576 0 562Z" fill={c.river} />
      <path d={`M0 790C70 760 150 785 220 760S330 755 360 780V${BOARD_H}H0Z`} fill="url(#bd-hill)" />
      <path d={`M0 835C90 815 200 835 360 820V${BOARD_H}H0Z`} fill={c.hill4} />
      <g>
        {DECO.map(([k, x, y]) => {
          const [w, h] = SIZE[k];
          const id = winter ? `bd-w${k}` : `bd-${k}`;
          return <use key={`${x}-${y}`} href={`#${id}`} x={x} y={y} width={w} height={h} />;
        })}
      </g>
      <path d={trail} fill="none" stroke="#FBEFD3" strokeWidth={20} strokeLinejoin="round" strokeLinecap="round" />
      <path d={trail} fill="none" stroke="#E2C58E" strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" />
      <rect x={296} y={528} width={40} height={40} rx={4} fill="#E8C99A" />
      <path d="M296 532v32M336 532v32" stroke="#9C7A4E" strokeWidth={4} strokeLinecap="round" />
      <Castle />
    </>
  );
}

