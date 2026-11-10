// SC-A13 の特典マスを作るフォーム。自由入力の文字欄は無い（選ぶだけ）。店の名前の欄も無い（URL の店だけ）。
import { useState, type FormEvent } from 'react';
import type { CampaignBody, CampaignView, Operator } from '../../../shared/admin.ts';
import {
  ITEM_CHOICES, MAX_DAYS, MIN_DAYS, PERCENT_CHOICES, YEN_CHOICES, campaignLabel, type CampaignKind, type ShopId,
} from '../../../shared/master/campaigns.ts';
import { createCampaign, errorText } from './api.ts';
import { addDays, spanDays, todayJst } from './dates.ts';
import { ErrorLine } from './widgets.tsx';

const DEFAULT_SPAN = 14;

const KIND_TEXT: Record<CampaignKind, string> = {
  item: '品（無料・サービス）',
  yen: '円引き',
  percent: '％引き',
};
const KIND_ORDER: readonly CampaignKind[] = ['item', 'yen', 'percent'];

interface Props {
  op: Operator;
  shop: ShopId;
  /** 作れない間は、フォーム全体を無効にする */
  disabled: boolean;
  onCreated: (c: CampaignView) => void;
  onConflict: () => void;
}

function bodyOf(kind: CampaignKind, itemKey: string, yen: number, percent: number, starts: string, ends: string): CampaignBody {
  const base = { requestId: crypto.randomUUID(), kind, starts, ends };
  if (kind === 'item') return { ...base, itemKey, value: null };
  return { ...base, itemKey: null, value: kind === 'yen' ? yen : percent };
}

function validateDates(starts: string, ends: string): string {
  if (starts === '' || ends === '') return '開始日と終了日をえらんでください。';
  const span = spanDays(starts, ends);
  if (span === null || span < MIN_DAYS || span > MAX_DAYS) {
    return `終了日は、開始日の${MIN_DAYS}〜${MAX_DAYS}日後にしてください。`;
  }
  return '';
}

export function CampaignForm({ op, shop, disabled, onCreated, onConflict }: Props) {
  const items = ITEM_CHOICES[shop];
  const tomorrow = addDays(todayJst(), 1);
  const [kind, setKind] = useState<CampaignKind>('item');
  const [itemKey, setItemKey] = useState(items[0]?.key ?? '');
  const [yen, setYen] = useState<number>(YEN_CHOICES[0]);
  const [percent, setPercent] = useState<number>(PERCENT_CHOICES[0]);
  const [starts, setStarts] = useState(tomorrow);
  const [ends, setEnds] = useState(addDays(tomorrow, DEFAULT_SPAN));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const value = kind === 'yen' ? yen : kind === 'percent' ? percent : null;
  const label = campaignLabel(kind, shop, kind === 'item' ? itemKey : null, value)[0];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || disabled) return;
    const dateError = validateDates(starts, ends);
    if (dateError) {
      setError(dateError);
      return;
    }
    setError('');
    setBusy(true);
    try {
      onCreated(await createCampaign(op, shop, bodyOf(kind, itemKey, yen, percent, starts, ends)));
    } catch (err: unknown) {
      setError(errorText(err, 'create'));
      onConflict();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" data-testid="campaign-form" aria-label="特典マスを作る" noValidate onSubmit={submit}>
      <fieldset className="plain" disabled={disabled}>
        <div className="fields">
          <div className="f">
            <fieldset className="plain">
              <legend className="lb">種類</legend>
              {KIND_ORDER.map((k) => (
                <label key={k} className="chk">
                  <input type="radio" name="kind" value={k} checked={kind === k} data-testid={`campaign-kind-${k}`} onChange={() => setKind(k)} />
                  {KIND_TEXT[k]}
                </label>
              ))}
            </fieldset>
          </div>
          <div className="f">
            {kind === 'item' ? (
              <>
                <label htmlFor="c-item">品（この店で選べるもの）</label>
                <select id="c-item" data-testid="campaign-item" value={itemKey} onChange={(e) => setItemKey(e.target.value)}>
                  {items.map((c) => <option key={c.key} value={c.key}>{c.name[0]}</option>)}
                </select>
              </>
            ) : kind === 'yen' ? (
              <>
                <label htmlFor="c-yen">引く金額</label>
                <select id="c-yen" data-testid="campaign-yen" value={yen} onChange={(e) => setYen(Number(e.target.value))}>
                  {YEN_CHOICES.map((n) => <option key={n} value={n}>{n}円引き</option>)}
                </select>
              </>
            ) : (
              <>
                <label htmlFor="c-percent">引く割合</label>
                <select id="c-percent" data-testid="campaign-percent" value={percent} onChange={(e) => setPercent(Number(e.target.value))}>
                  {PERCENT_CHOICES.map((n) => <option key={n} value={n}>{n}％引き</option>)}
                </select>
              </>
            )}
          </div>
          <div className="f">
            <label htmlFor="c-starts">開始日</label>
            <input id="c-starts" type="date" data-testid="campaign-starts" value={starts} aria-describedby="c-starts-h" onChange={(e) => setStarts(e.target.value)} />
            <p className="hint" id="c-starts-h">明日以降の日をえらびます</p>
          </div>
          <div className="f">
            <label htmlFor="c-ends">終了日</label>
            <input id="c-ends" type="date" data-testid="campaign-ends" value={ends} aria-describedby="c-ends-h" onChange={(e) => setEnds(e.target.value)} />
            <p className="hint" id="c-ends-h">開始日の{MIN_DAYS}〜{MAX_DAYS}日後までです</p>
          </div>
        </div>
        <p className="preview" data-testid="campaign-preview" hidden>
          確認：「{label}」を、{starts || '（開始日）'}から{ends || '（終了日）'}まで出します。この店だけで使えます。
        </p>
        <ErrorLine text={error} />
        <div className="actions">
          <button type="submit" className="btn" data-testid="campaign-submit" disabled={disabled || busy}>
            {busy ? '送っています…' : '確認に送る'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
