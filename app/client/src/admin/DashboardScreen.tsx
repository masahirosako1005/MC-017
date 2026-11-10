// SC-A02 ダッシュボード（観光協会）。K-01・K-02・K-03・K-07 と再訪までの5つの段階、気づき1件。
import { useState, type ReactNode } from 'react';
import type { AdminSummary, CountM, Operator, RateM } from '../../../shared/admin.ts';
import { spotById } from '../../../shared/master/spots.ts';
import { getSummary, type Period } from './api.ts';
import { useLoad } from './useLoad.ts';
import { BarList, ColumnChart } from './Charts.tsx';
import { Async, CountText, PeriodSelect, RateText, countOf, diffOf, shortDay, type Diff } from './widgets.tsx';

const FUNNEL_LABEL: Record<AdminSummary['funnel'][number]['key'], string> = {
  came: '来た',
  trigger: 'きっかけ（QR・ひとこと・誘う）',
  rolled: 'さいころを振った',
  reason: '次に来る理由を持って帰った',
  revisit: '再訪した',
};

const PREV_LABEL = '前の期間より';

function Kpi({ id, name, value, diff }: { id: string; name: string; value: ReactNode; diff: Diff | null }) {
  return (
    <div className="card kpi" data-testid={id}>
      <h3 className="nm">{name}</h3>
      <p className="v">{value}</p>
      <p className={`d ${diff ? diff.cls : 'none'}`}>{diff ? diff.text : '全期間のため、前の期間はありません'}</p>
    </div>
  );
}

function countDiff(now: CountM, prev: CountM, on: boolean): Diff | null {
  return on ? diffOf(countOf(now), countOf(prev), '人', PREV_LABEL) : null;
}

function rateDiff(now: RateM, prev: RateM, on: boolean): Diff | null {
  if (!on) return null;
  const a = now.hidden ? null : now.percent;
  const b = prev.hidden ? null : prev.percent;
  return diffOf(a, b, 'ポイント', PREV_LABEL);
}

function Funnel({ rows }: { rows: AdminSummary['funnel'] }) {
  const top = rows.find((r) => r.key === 'came');
  const max = top ? countOf(top.count) : null;
  return (
    <table data-testid="funnel">
      <caption>再訪までの5つの段階（前の段階も通った人だけを数えます）</caption>
      <thead>
        <tr>
          <th scope="col">段階</th>
          <th scope="col" className="n">人数</th>
          <th scope="col" className="barcell"><span className="small">棒（飾り。同じ数字が左にあります）</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const n = countOf(r.count);
          return (
            <tr key={r.key} data-testid={`funnel-${r.key}`}>
              <th scope="row">{FUNNEL_LABEL[r.key]}</th>
              <td className="n"><CountText m={r.count} unit="人" /></td>
              <td>
                {n !== null && max !== null && max > 0 ? <progress className="bar" max={max} value={Math.min(n, max)} aria-hidden="true" /> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** スポットごとの次回再訪の予定。予定を入れた人と、LINE で友だちを誘った人（見本の送信の記録） */
function SpotPlans({ rows }: { rows: AdminSummary['spotPlans'] }) {
  return (
    <div data-testid="spot-plans">
      <h2>次回再訪の予定（スポットごと）</h2>
      <p className="small">「次に行く予定」を入れた人と、LINE で友だちを誘った人の人数です（同じ人が何回送っても1人）。</p>
      <ColumnChart
        caption="スポットごとの次回再訪の予定"
        names={['次に行く予定の人', 'LINEで誘った人']}
        unit="人"
        groups={rows.map((r) => ({
          key: r.spotId,
          label: spotById(r.spotId).name[0],
          values: [countOf(r.planners), countOf(r.inviters)],
        }))}
      />
    </div>
  );
}

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const COMP_LABEL: Record<string, string> = { solo: 'ひとり', family: '家族', couple: 'ふたり（恋人・夫婦）', friends: '友だち', none: '選んでいない人' };
const AGE_LABEL: Record<string, string> = { '10s': '10代', '20s': '20代', '30s': '30代', '40s': '40代', '50s': '50代', '60s': '60代以上', none: '年代を選んでいない人' };

/** ダミーデータからも分かること: いつ来ているか（週・曜日）、どんな人か（年代） */
function Trends({ s }: { s: AdminSummary }) {
  return (
    <>
      <h2>いつ来ているか</h2>
      <div className="grid g2">
        <ColumnChart
          caption="7日ごとの来た人数（期間の最初の日から数えます）"
          names={['来た人', 'うち再訪した人']}
          unit="人"
          groups={s.weekly.map((w) => ({ key: w.from, label: `${shortDay(w.from)}〜`, values: [countOf(w.users), countOf(w.revisitors)] }))}
        />
        <ColumnChart
          caption="曜日ごとの来た回数"
          names={['来た回数']}
          unit="回"
          groups={s.weekdays.map((d) => ({ key: String(d.dow), label: DOW[d.dow] ?? '', values: [countOf(d.visits)] }))}
        />
      </div>
      <h2>どんな人が来ているか</h2>
      <section className="card" aria-label="年代ごとの利用者数" data-testid="ages-chart">
        <h3 className="nm">年代ごとの利用者数</h3>
        <BarList
          unit="人"
          rows={s.ages.map((a) => ({ key: a.age ?? 'none', label: AGE_LABEL[a.age ?? 'none'] ?? '', value: countOf(a.users) }))}
        />
      </section>
      <section className="card" aria-label="誰と来たか別の利用者数" data-testid="companions-chart">
        <h3 className="nm">誰と来たか</h3>
        <BarList
          unit="人"
          rows={s.companions.map((c) => ({ key: c.companion ?? 'none', label: COMP_LABEL[c.companion ?? 'none'] ?? '', value: countOf(c.users) }))}
        />
      </section>
    </>
  );
}

function SummaryView({ s }: { s: AdminSummary }) {
  const cmp = s.period.days !== null;
  return (
    <>
      <p className="small" data-testid="period-range">集計の期間: {s.period.from}〜{s.period.to}</p>
      <h2 className="sr-only">主な数字</h2>
      <div className="grid g4">
        <Kpi id="kpi-k01" name="利用者数" value={<CountText m={s.k01.now} unit="人" />} diff={countDiff(s.k01.now, s.k01.prev, cmp)} />
        <Kpi id="kpi-k02" name="再訪率" value={<RateText m={s.k02.now} />} diff={rateDiff(s.k02.now, s.k02.prev, cmp)} />
        <Kpi id="kpi-k03" name="次に来る理由を持った割合" value={<RateText m={s.k03.now} />} diff={rateDiff(s.k03.now, s.k03.prev, cmp)} />
        <Kpi id="kpi-k07" name="次回クーポンの利用率" value={<RateText m={s.k07.now} />} diff={rateDiff(s.k07.now, s.k07.prev, cmp)} />
      </div>
      <p className="small">
        再訪＝前に来た日から7日以上あけて来た日。旅の2日目は数えません。次に来る理由＝帰るときに「盤の途中」「次に行く予定」「次に来た日から使えるクーポン」のどれかを持っていたこと。
      </p>
      {s.insight ? (
        <section className="card insight" aria-labelledby="insight-h" data-testid="insight">
          <h2 id="insight-h">気づき</h2>
          <p><b>{s.insight.text}</b></p>
        </section>
      ) : null}
      <h2>再訪までの流れ</h2>
      <Funnel rows={s.funnel} />
      <SpotPlans rows={s.spotPlans} />
      <Trends s={s} />
    </>
  );
}

export function DashboardScreen({ op }: { op: Operator }) {
  const [period, setPeriod] = useState<Period>('28');
  const { load, retry } = useLoad(() => getSummary(op, period), `${op}/${period}`);
  return (
    <div data-testid="screen-dashboard">
      <h1>ダッシュボード</h1>
      <p className="lead">満足度ではなく、「次に来る理由を持って帰ったか」と「本当にまた来たか」を見ます。</p>
      <div className="filters"><PeriodSelect id="dash-period" value={period} onChange={setPeriod} /></div>
      <Async load={load} retry={retry}>{(s) => <SummaryView s={s} />}</Async>
    </div>
  );
}

