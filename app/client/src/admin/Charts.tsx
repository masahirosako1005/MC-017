// 運営向けのグラフ（外部のグラフ部品は使わず、SVG の属性だけで描く。インライン style なし＝CSP の style-src 'self' のまま）。
// 数字は棒の上・横に文字でも出す。5人未満の値は null で渡し、「5人未満」と文字で出す（棒は描かない）。
import type { ReactNode } from 'react';
import { HIDDEN_COUNT } from './widgets.tsx';

export interface BarRow { key: string; label: string; value: number | null; text?: ReactNode }

/** 横棒（ラベル・棒・数字）。最大値を 100% にする */
export function BarList({ rows, unit }: { rows: BarRow[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="bl-label">{r.label}</span>
          <svg className="bl-bar" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <rect className="bl-track" x="0" y="0" width="100" height="10" rx="2" />
            {r.value !== null && r.value > 0 ? <rect className="bl-fill" x="0" y="0" width={(r.value / max) * 100} height="10" rx="2" /> : null}
          </svg>
          <span className="bl-val">{r.text ?? (r.value === null ? <span className="hide">{HIDDEN_COUNT}</span> : `${r.value.toLocaleString('ja-JP')}${unit}`)}</span>
        </li>
      ))}
    </ul>
  );
}

export interface ColumnGroup { key: string; label: string; values: (number | null)[] }

const W = 640;
const PLOT_H = 170;
const TOP = 26;
const CAT_FONT = 14;
const BASE = TOP + PLOT_H;

/** 縦棒（グループごとに系列の本数だけ並べる）。同じデータを、画面に出さない表（読み上げ用）でも持つ */
export function ColumnChart({ caption, names, groups, unit }: { caption: string; names: string[]; groups: ColumnGroup[]; unit: string }) {
  const longest = Math.max(1, ...groups.map((g) => [...g.label].length));
  const H = BASE + 14 + longest * CAT_FONT;
  const max = Math.max(1, ...groups.flatMap((g) => g.values.map((v) => v ?? 0)));
  const slot = W / Math.max(1, groups.length);
  const bw = Math.min(46, (slot - 14) / names.length);
  return (
    <figure className="chart">
      <figcaption>{caption}</figcaption>
      <ul className="legend" aria-label="凡例">
        {names.map((n, i) => (
          <li key={n}><svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false"><rect className={`s${i}`} width="14" height="14" rx="3" /></svg>{n}</li>
        ))}
      </ul>
      <svg className="col" viewBox={`0 0 ${W} ${H}`} role="presentation" aria-hidden="true" focusable="false">
        <line className="axis" x1="0" y1={BASE} x2={W} y2={BASE} />
        {groups.map((g, gi) => {
          const x0 = gi * slot + (slot - bw * names.length) / 2;
          return (
            <g key={g.key}>
              {g.values.map((v, si) => {
                const h = v === null ? 0 : (v / max) * (BASE - TOP);
                const x = x0 + si * bw;
                return (
                  <g key={names[si]}>
                    {v !== null ? <rect className={`s${si}`} x={x + 2} y={BASE - h} width={bw - 4} height={h} rx="3" /> : null}
                    <text className="val" x={x + bw / 2} y={(v === null ? BASE : BASE - h) - 5} textAnchor="middle">{v === null ? '<5' : v}</text>
                  </g>
                );
              })}
              <text className="cat" x={gi * slot + slot / 2} y={BASE + 10}>{g.label}</text>
            </g>
          );
        })}
      </svg>
      <p className="small">単位: {unit}</p>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr><th scope="col">区切り</th>{names.map((n) => <th key={n} scope="col">{n}</th>)}</tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key}>
              <th scope="row">{g.label}</th>
              {g.values.map((v, i) => <td key={names[i]}>{v === null ? HIDDEN_COUNT : `${v}${unit}`}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

