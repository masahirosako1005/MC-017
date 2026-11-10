// SC-A10 店舗ダッシュボード（店）。自店の券・QR・時間帯・同じ日に寄ったスポット・キャンペーン。
import { useState, type ReactNode } from 'react';
import type { Operator, ShopSummary } from '../../../shared/admin.ts';
import type { ShopId } from '../../../shared/master/campaigns.ts';
import { spotById } from '../../../shared/master/spots.ts';
import { getShopSummary, type Period } from './api.ts';
import { shopName, type View } from './role.ts';
import { useLoad } from './useLoad.ts';
import { BarList, ColumnChart } from './Charts.tsx';
import { Async, CountText, PeriodSelect, PhaseChip, countOf, periodText } from './widgets.tsx';

function Card({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  return (
    <div className="card kpi" data-testid={id}>
      <h3 className="nm">{name}</h3>
      <p className="v">{children}</p>
    </div>
  );
}

function HourlyTable({ rows }: { rows: ShopSummary['hourly'] }) {
  return (
    <table data-testid="hourly-table">
      <caption>クーポンが使われた時間帯</caption>
      <thead>
        <tr><th scope="col">時間</th><th scope="col" className="n">使われた券</th></tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={2}>まだ使われた券はありません。</td></tr>
        ) : rows.map((r) => (
          <tr key={r.from}>
            <th scope="row">{r.from}〜{r.to}時</th>
            <td className="n"><CountText m={r.count} unit="枚" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SameDayTable({ rows }: { rows: ShopSummary['sameDay'] }) {
  return (
    <table data-testid="sameday-table">
      <caption>同じ日に寄ったスポット（クーポンを使った人）</caption>
      <thead>
        <tr><th scope="col">スポット</th><th scope="col" className="n">人数</th></tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={2}>まだ集計できる人がいません。</td></tr>
        ) : rows.map((r) => (
          <tr key={r.spotId}>
            <th scope="row">{spotById(r.spotId).name[0]}</th>
            <td className="n"><CountText m={r.people} unit="人" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CampaignTable({ rows }: { rows: ShopSummary['campaigns'] }) {
  if (rows.length === 0) return <p data-testid="campaigns-empty">まだキャンペーンはありません。</p>;
  return (
    <table data-testid="campaign-table">
      <caption className="sr-only">店の特典マスのキャンペーン</caption>
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
            <td><PhaseChip phase={c.phase} /></td>
            <td className="n"><CountText m={c.landed} unit="人" /></td>
            <td className="n"><CountText m={c.used} unit="枚" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SummaryView({ s, go }: { s: ShopSummary; go: (v: View) => void }) {
  return (
    <>
      {s.unreadVoices > 0 ? (
        <div className="card status ng" role="status" data-testid="unread-notice">
          未確認のお客さまの声が {s.unreadVoices} 件あります。
          <button type="button" className="linkbtn" onClick={() => go('voices')}>声を見る</button>
        </div>
      ) : null}
      <p className="small" data-testid="period-range">集計の期間: {s.period.from}〜{s.period.to}</p>
      <h2 className="sr-only">主な数字</h2>
      <div className="grid g4">
        <Card id="shop-issued" name="配った券"><CountText m={s.coupons.issued} unit="枚" /></Card>
        <Card id="shop-used" name="使われた券"><CountText m={s.coupons.used} unit="枚" /></Card>
        <Card id="shop-revisit" name="再訪の日に使われた券"><CountText m={s.coupons.usedOnRevisit} unit="枚" /></Card>
        <Card id="shop-qr" name="QR を読んだ人"><CountText m={s.qr} unit="人" /></Card>
      </div>
      <h2>グラフ</h2>
      <div className="grid g2">
        <ColumnChart
          caption="クーポンが使われた時間帯"
          names={['使われた券']}
          unit="枚"
          groups={s.hourly.map((h) => ({ key: String(h.from), label: `${h.from}〜${h.to}時`, values: [countOf(h.count)] }))}
        />
        <section className="card" aria-label="同じ日に寄ったスポット">
          <h3 className="nm">同じ日に寄ったスポット（クーポンを使った人）</h3>
          {s.sameDay.length === 0 ? <p>まだ集計できる人がいません。</p> : (
            <BarList unit="人" rows={s.sameDay.map((r) => ({ key: r.spotId, label: spotById(r.spotId).name[0], value: countOf(r.people) }))} />
          )}
        </section>
      </div>
      <div className="grid g2 gap-top">
        <HourlyTable rows={s.hourly} />
        <SameDayTable rows={s.sameDay} />
      </div>
      <h2>店の特典マスのキャンペーン</h2>
      <CampaignTable rows={s.campaigns} />
    </>
  );
}

export function ShopScreen({ op, shop, go }: { op: Operator; shop: ShopId; go: (v: View) => void }) {
  const [period, setPeriod] = useState<Period>('28');
  const { load, retry } = useLoad(() => getShopSummary(op, shop, period), `${op}/${period}`);
  return (
    <div data-testid="screen-shop">
      <h1>店舗ダッシュボード（{shopName(shop)}）</h1>
      <p className="lead">自分の店のクーポンと QR だけを表示します。ほかの店の数字は見えません。</p>
      <div className="filters"><PeriodSelect id="shop-period" value={period} onChange={setPeriod} /></div>
      <Async load={load} retry={retry}>{(s) => <SummaryView s={s} go={go} />}</Async>
    </div>
  );
}
