// 画面をまたいで使う小さな部品。小さい人数の見せ方（5人未満・参考）はここに集める。
import type { ReactNode } from 'react';
import type { CampaignPhase, CampaignView, CountM, RateM, RejectReason } from '../../../shared/admin.ts';
import type { Period } from './api.ts';
import type { Load } from './useLoad.ts';

export const HIDDEN_COUNT = '5人未満';
export const HIDDEN_RATE = 'データがありません';

export const PERIOD_LABEL: Record<Period, string> = { '7': '7日', '28': '28日', '90': '90日', all: '全期間' };
const PERIOD_ORDER: readonly Period[] = ['7', '28', '90', 'all'];

function num(n: number): string {
  return n.toLocaleString('ja-JP');
}

function round1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function countOf(m: CountM): number | null {
  return m.hidden ? null : m.value;
}

export function CountText({ m, unit = '' }: { m: CountM; unit?: string }) {
  const v = countOf(m);
  return v === null ? <span className="hide">{HIDDEN_COUNT}</span> : <>{num(v)}{unit}</>;
}

export function Chip({ kind, children }: { kind: 'wait' | 'act' | 'end' | 'rej' | 'up' | 'ref'; children: ReactNode }) {
  return <span className={`chip c-${kind}`}>{children}</span>;
}

export function RateText({ m }: { m: RateM }) {
  if (m.hidden || m.percent === null) return <span className="hide">{HIDDEN_RATE}</span>;
  return (
    <>
      {round1(m.percent)}%{m.reference ? <> <Chip kind="ref">参考</Chip></> : null}
    </>
  );
}

export interface Diff { text: string; cls: 'up' | 'down' | 'same' | 'none' }

/** 前の期間との差。記号と文字で示し、色は補助 */
export function diffOf(now: number | null, prev: number | null, unit: string, label: string): Diff {
  if (now === null || prev === null) return { text: '前の期間のデータがないため、差は出せません', cls: 'none' };
  const d = Math.round((now - prev) * 10) / 10;
  if (d > 0) return { text: `▲ ${round1(d)}${unit}（${label}）`, cls: 'up' };
  if (d < 0) return { text: `▼ ${round1(-d)}${unit}（${label}）`, cls: 'down' };
  return { text: '― 変わらず', cls: 'same' };
}

export function PeriodSelect({ id, value, onChange }: { id: string; value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="f">
      <label htmlFor={id}>期間</label>
      <select
        id={id}
        data-testid="period"
        value={value}
        onChange={(e) => {
          const p = PERIOD_ORDER.find((x) => x === e.target.value);
          if (p) onChange(p);
        }}
      >
        {PERIOD_ORDER.map((p) => (
          <option key={p} value={p}>{p === 'all' ? '全期間' : `直近${PERIOD_LABEL[p]}`}</option>
        ))}
      </select>
    </div>
  );
}

/** 読み込み中・失敗・成功の切り替え */
export function Async<T>({ load, retry, children }: { load: Load<T>; retry: () => void; children: (d: T) => ReactNode }) {
  if (load.kind === 'loading') return <p className="loading" aria-busy="true" data-testid="loading">読み込み中…</p>;
  if (load.kind === 'error') {
    return (
      <div className="status wa" role="alert" data-testid="load-error">
        <p>{load.message}</p>
        <button type="button" className="btn sub" onClick={retry}>もう一度</button>
      </div>
    );
  }
  return <>{children(load.data)}</>;
}

/** 更新の知らせ。入れ物は最初から置いておく（あとから文字が入ると読み上げられる） */
export function StatusLine({ text }: { text: string }) {
  return <div className={text ? 'status ok' : 'status-empty'} role="status" data-testid="status">{text}</div>;
}

export function ErrorLine({ text }: { text: string }) {
  return <div className={text ? 'status wa' : 'status-empty'} role="alert" data-testid="error">{text ? `⚠ ${text}` : ''}</div>;
}

const PHASE_TEXT: Record<CampaignPhase, string> = {
  pending: '確認待ち',
  rejected: '差し戻し',
  scheduled: '開始前',
  running: '実施中',
  ended: '終了',
};
const PHASE_CHIP: Record<CampaignPhase, 'wait' | 'act' | 'end' | 'rej' | 'up'> = {
  pending: 'wait', rejected: 'rej', scheduled: 'up', running: 'act', ended: 'end',
};

export function PhaseChip({ phase }: { phase: CampaignPhase }) {
  return <Chip kind={PHASE_CHIP[phase]}>{PHASE_TEXT[phase]}</Chip>;
}

export const REJECT_TEXT: Record<RejectReason, string> = {
  unclear: '内容がわかりにくい',
  dates: '期間を見直してほしい',
  other: 'そのほか',
};
// 値の import（zod を巻き込む）を避けて、選択肢の並びはここで持つ
export const REJECT_ORDER: readonly RejectReason[] = ['unclear', 'dates', 'other'];

/** 2026-11-08 → 11/08 */
export function shortDay(day: string): string {
  return day.length >= 10 ? `${day.slice(5, 7)}/${day.slice(8, 10)}` : day;
}

export function periodText(c: Pick<CampaignView, 'starts' | 'ends'>): string {
  return `${c.starts}〜${c.ends}`;
}
