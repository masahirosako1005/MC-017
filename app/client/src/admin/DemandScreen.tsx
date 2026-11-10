// SC-A13 近くの予定と特典マス（店）。近くの予定の人数（5人未満は数字を出さない）、作るフォーム、作った一覧。
import { useState } from 'react';
import type { CampaignView, DemandView, Operator } from '../../../shared/admin.ts';
import type { ShopId } from '../../../shared/master/campaigns.ts';
import { spotById } from '../../../shared/master/spots.ts';
import { getDemand, getShopCampaigns } from './api.ts';
import { BarList } from './Charts.tsx';
import { CampaignForm } from './CampaignForm.tsx';
import { shopName } from './role.ts';
import { useLoad } from './useLoad.ts';
import { Async, CountText, PhaseChip, REJECT_TEXT, StatusLine, countOf, periodText } from './widgets.tsx';

const SENT_TEXT = '登録しました';

function totalText(d: DemandView): string {
  if (d.total.hidden || d.total.value === null) return '5人未満';
  return `${d.total.value}人${d.totalAtLeast ? '以上' : ''}`;
}

/** 作れない理由を文で出す（人数が足りない／確認待ちがある） */
function reasons(d: DemandView): string[] {
  const out: string[] = [];
  if (d.blocking) {
    out.push(`すでに確認待ちのものがあります（「${d.blocking.label[0]}」）。観光協会の確認が終わってから作れます。`);
  }
  const short = d.total.hidden || d.total.value === null || d.total.value < d.threshold;
  if (short) {
    out.push(
      d.remaining === null
        ? `近くの予定の人数が足りません。${d.threshold}人以上のときに作れます。`
        : `近くの予定の人数が足りません。あと${d.remaining}人で作れます（${d.threshold}人以上のときに作れます）。`,
    );
  }
  return out;
}

function DemandTable({ d }: { d: DemandView }) {
  return (
    <>
      <BarList unit="人" rows={d.spots.map((s) => ({ key: s.spotId, label: spotById(s.spotId).name[0], value: countOf(s.people) }))} />
      <table data-testid="demand-table">
        <caption>予定の人数（店から{(d.radiusM / 1000).toFixed(1)}km 以内。5人未満は数字を出しません）</caption>
        <thead>
          <tr><th scope="col">スポット</th><th scope="col" className="n">予定の人数</th></tr>
        </thead>
        <tbody>
          {d.spots.map((s) => (
            <tr key={s.spotId}>
              <th scope="row">{spotById(s.spotId).name[0]}</th>
              <td className="n"><CountText m={s.people} unit="人" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="total" data-testid="demand-total">合計: {totalText(d)}</p>
    </>
  );
}

function CampaignList({ rows }: { rows: CampaignView[] }) {
  if (rows.length === 0) return <p data-testid="campaign-list-empty">まだ作っていません。</p>;
  return (
    <table data-testid="campaign-list">
      <caption className="sr-only">作った・作っているキャンペーン</caption>
      <thead>
        <tr>
          <th scope="col">名前</th>
          <th scope="col">期間</th>
          <th scope="col">状態</th>
          <th scope="col" className="n">止まった人</th>
          <th scope="col" className="n">使われた券</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} data-testid="campaign-row">
            <th scope="row">{c.label[0]}</th>
            <td>{periodText(c)}</td>
            <td>
              <PhaseChip phase={c.phase} />
              {c.rejectReason ? <span className="small"> 理由: {REJECT_TEXT[c.rejectReason]}</span> : null}
            </td>
            <td className="n"><CountText m={c.landed} unit="人" /></td>
            <td className="n"><CountText m={c.used} unit="枚" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DemandScreen({ op, shop }: { op: Operator; shop: ShopId }) {
  const demand = useLoad(() => getDemand(op, shop), `d/${op}`);
  const list = useLoad(() => getShopCampaigns(op, shop), `c/${op}`);
  const [sent, setSent] = useState('');

  function created() {
    setSent(SENT_TEXT);
    demand.refresh();
    list.refresh();
  }

  return (
    <div data-testid="screen-demand">
      <h1>近くの予定と特典マス（{shopName(shop)}）</h1>
      <p className="lead">近くのスポットに「次に行く予定」を入れている人が多いとき、自分の店の特典を、その人たちのすごろくに特典マスとして出せます。</p>
      <h2>近くのスポットの次回の予定</h2>
      <Async load={demand.load} retry={demand.retry}>{(d) => <DemandTable d={d} />}</Async>

      <h2>特典マスを作る</h2>
      <StatusLine text={sent} />
      <Async load={demand.load} retry={demand.retry}>
        {(d) => {
          const why = d.canCreate ? [] : reasons(d);
          return (
            <>
              {why.length > 0 ? (
                <div className="status ng" data-testid="demand-reason" id="demand-reason">
                  {why.map((t) => <p key={t}>{t}</p>)}
                </div>
              ) : null}
              <CampaignForm op={op} shop={shop} disabled={!d.canCreate} onCreated={created} onConflict={demand.refresh} />
            </>
          );
        }}
      </Async>

      <h2>作った・作っているキャンペーン</h2>
      <Async load={list.load} retry={list.retry}>{(rows) => <CampaignList rows={rows} />}</Async>
    </div>
  );
}
