// SC-A15 お客さまの声（店）。名前・ID・一緒に来た人・時刻は画面に出さない（API も返さない）。
import { useRef, useState } from 'react';
import type { Operator, VoiceView, VoicesView } from '../../../shared/admin.ts';
import type { Age } from '../../../shared/schemas.ts';
import type { ShopId } from '../../../shared/master/campaigns.ts';
import { confirmVoice, errorText, getVoices, type VoiceFilter } from './api.ts';
import { shopName } from './role.ts';
import { useLoad } from './useLoad.ts';
import { Async, Chip, ErrorLine, StatusLine, shortDay } from './widgets.tsx';

const AGE_TEXT: Record<Age, string> = {
  '10s': '10代', '20s': '20代', '30s': '30代', '40s': '40代', '50s': '50代', '60s': '60代以上',
};
const FILTERS: readonly { v: VoiceFilter; text: string }[] = [
  { v: 'all', text: 'すべて' },
  { v: 'unread', text: '未確認だけ' },
  { v: 'read', text: '確認済みだけ' },
];

function ageText(a: Age | null): string {
  return a === null ? '年代なし' : AGE_TEXT[a];
}

function Count({ id, name, n }: { id: string; name: string; n: number }) {
  return (
    <div className="card kpi" data-testid={id}>
      <h3 className="nm">{name}</h3>
      <p className="v">{n}件</p>
    </div>
  );
}

function Item({ v, busy, onConfirm }: { v: VoiceView; busy: boolean; onConfirm: (v: VoiceView) => void }) {
  return (
    <li className="card voice" data-testid="voice-item">
      <p className="voice-text">{v.text}</p>
      <p className="small">
        {shortDay(v.day)} ・ {ageText(v.age)}{' '}
        <Chip kind={v.read ? 'act' : 'wait'}>{v.read ? '確認済み' : '未確認'}</Chip>
        {v.masked ? <> <Chip kind="rej">電話番号などを伏せました</Chip></> : null}
        {v.dummy ? <> <Chip kind="end">ダミー</Chip></> : null}
      </p>
      {v.read ? null : (
        <button
          type="button"
          className="btn sub"
          data-testid="voice-confirm"
          disabled={busy}
          aria-label={`確認した（${shortDay(v.day)} ${ageText(v.age)}の声）`}
          onClick={() => onConfirm(v)}
        >
          確認した
        </button>
      )}
    </li>
  );
}

function VoiceList({ d, busy, onConfirm }: { d: VoicesView; busy: boolean; onConfirm: (v: VoiceView) => void }) {
  if (d.items.length === 0) return <p data-testid="voices-empty">この条件に合う声は、まだありません。</p>;
  return (
    <ul className="cards" aria-label="お客さまの声の一覧" data-testid="voice-list">
      {d.items.map((v) => <Item key={v.id} v={v} busy={busy} onConfirm={onConfirm} />)}
    </ul>
  );
}

export function VoicesScreen({ op, shop }: { op: Operator; shop: ShopId }) {
  const [show, setShow] = useState<VoiceFilter>('all');
  const { load, retry, refresh } = useLoad(() => getVoices(op, shop, show), `${op}/${show}`);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const head = useRef<HTMLHeadingElement>(null);

  async function confirm(v: VoiceView) {
    if (busy) return;
    setBusy(true);
    setStatus('');
    setError('');
    try {
      await confirmVoice(op, shop, v.id);
      setStatus('確認しました。未確認の件数が1件減りました。');
      head.current?.focus();
    } catch (e: unknown) {
      setError(errorText(e, 'confirm'));
    } finally {
      setBusy(false);
      refresh();
    }
  }

  return (
    <div data-testid="screen-voices">
      <h1>お客さまの声（{shopName(shop)}）</h1>
      <p className="lead">お店で書かれた「ひとこと」のうち、お店の人に見えると知らせたものだけを表示します。名前や ID は出ません。</p>
      <p className="small note" data-testid="voices-note">この画面は、お店の人だけに見えます。観光協会には出ません。</p>
      <StatusLine text={status} />
      <ErrorLine text={error} />
      <Async load={load} retry={retry}>
        {(d) => (
          <div className="grid g3">
            <Count id="voices-all" name="声の数" n={d.counts.all} />
            <Count id="voices-unread" name="未確認" n={d.counts.unread} />
            <Count id="voices-read" name="確認済み" n={d.counts.read} />
          </div>
        )}
      </Async>
      <div className="filters gap-top">
        <div className="f">
          <label htmlFor="voice-filter">表示する声</label>
          <select id="voice-filter" data-testid="voice-filter" value={show} onChange={(e) => setShow(FILTERS.find((f) => f.v === e.target.value)?.v ?? 'all')}>
            {FILTERS.map((f) => <option key={f.v} value={f.v}>{f.text}</option>)}
          </select>
        </div>
      </div>
      <h2 ref={head} tabIndex={-1}>声の一覧</h2>
      <Async load={load} retry={retry}>
        {(d) => <VoiceList d={d} busy={busy} onConfirm={(v) => void confirm(v)} />}
      </Async>
      <p className="small note">電話番号・メール・URL は自動で伏せます。「確認した」は、お店の中だけの目印で、書いた人には伝わりません。取り消しはできません。</p>
    </div>
  );
}
