// SC-06 うわさ（R-027、index.html の rumor）。CSV 由来の人数だけを出す。年齢・一緒に来た人が未選択なら選び方を案内する。
import { useCallback, useEffect, useState } from 'react';
import { SPOT_IDS, spotById, type SpotId } from '../../../shared/master/spots.ts';
import type { Rank, Rumors } from '../../../shared/schemas.ts';
import { api } from '../api.ts';
import { useApp } from '../app-context.ts';
import { errorText } from '../error-text.ts';
import { useT } from '../i18n/index.ts';
import { Frame } from '../ui/Frame.tsx';
import { Icon } from '../ui/Icon.tsx';

function RankList({ rows, testId }: { rows: readonly Rank[]; testId: string }) {
  const { go } = useApp();
  const { t, L } = useT();
  const max = rows[0]?.people ?? 0;
  if (rows.length === 0) return <div className="card" data-testid={testId}><p className="muted">{t('noData')}</p></div>;
  return (
    <div className="card" data-testid={testId}>
      {rows.map((r, i) => (
        <button key={r.spotId} type="button" className="rank" data-spot={r.spotId} onClick={() => go('detail', r.spotId)}>
          <span className="no">{i + 1}</span>
          <div className="grow"><b>{L(spotById(r.spotId).name)}</b><div className="meter" aria-hidden="true"><i style={{ width: `${max > 0 ? (r.people / max) * 100 : 0}%` }} /></div></div>
          <span className="n">{t('peopleN', { n: r.people })}</span>
          <span className="chev" aria-hidden="true"><Icon name="chev" size={20} /></span>
        </button>
      ))}
    </div>
  );
}

function ChooseFirst({ testId }: { testId: string }) {
  const { go } = useApp();
  const { t } = useT();
  return (
    <div className="card" data-testid={testId}>
      <p>{t('chooseToSee')}</p>
      <button type="button" className="btn ghost sm gap10" onClick={() => go('home')}>{t('chooseGo')}</button>
    </div>
  );
}

export function RumorScreen() {
  const { me } = useApp();
  const { t, L } = useT();
  const [spot, setSpot] = useState<SpotId>('s1');
  const [data, setData] = useState<Rumors | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { age, companion } = me.profile;

  const load = useCallback(async (s: SpotId) => {
    setErr(null);
    try {
      setData(await api<Rumors>('GET', `/rumors?spot=${encodeURIComponent(s)}`));
    } catch (e) {
      setErr(errorText(t, e));
    }
  }, [t]);
  useEffect(() => { void load(spot); }, [load, spot]);

  const ageH = age ? t('sameAgeH', { a: t(`age-${age}`) }) : t('sameAgeNone');
  const compH = companion === 'solo' ? t('sameCompSolo') : companion ? t('sameCompH', { c: t(`comp-${companion}`) }) : t('sameCompNone');
  const hours = data?.quiet.hours ?? [];
  const maxH = Math.max(1, ...hours.map((h) => h.count));
  const hoursLabel = hours.map((h) => `${t('hourN', { h: h.hour })}${h.quiet ? ` ${t('quietTag')}` : ''}`).join('、');

  return (
    <Frame title={t('rumor')}>
      <p className="lead top4">{t('rumorLead')}</p>
      {err && (
        <div className="problem" role="alert"><p>{err}</p>
          <button type="button" className="btn primary sm" onClick={() => void load(spot)}>{t('retry')}</button></div>
      )}
      {!data && !err && <p className="card loading" role="status">{t('loading')}</p>}
      {data && (
        <>
          <h2>{t('yesterday')}</h2>
          <RankList rows={data.yesterday} testId="rk-yesterday" />
          <h2>{t('monthTop')}</h2>
          <RankList rows={data.month} testId="rk-month" />
          <h2>{ageH}</h2>
          {data.sameAge ? <RankList rows={data.sameAge} testId="rk-age" /> : <ChooseFirst testId="rk-age" />}
          <h2>{compH}</h2>
          {data.sameCompanion ? <RankList rows={data.sameCompanion} testId="rk-comp" /> : <ChooseFirst testId="rk-comp" />}
          <h2>{t('quietH', { s: L(spotById(data.quiet.spotId).name) })}</h2>
          <div className="card">
            <div className="sel">
              <label htmlFor="quiet-spot">{t('quietSpot')}</label>
              <select id="quiet-spot" value={spot} data-testid="quiet-spot" onChange={(e) => setSpot(e.target.value as SpotId)}>
                {SPOT_IDS.map((id) => <option key={id} value={id}>{L(spotById(id).name)}</option>)}
              </select>
            </div>
            <div className="hours" role="img" aria-label={hoursLabel} data-testid="quiet-hours">
              {hours.map((h) => (
                <div key={h.hour} className={`h${h.quiet ? ' q' : ''}`}>
                  {h.quiet && <em>{t('quietTag')}</em>}
                  <i style={{ height: `${(h.count / maxH) * 82}%` }} />
                  <span>{t('hourN', { h: h.hour })}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="fiction">{t('dummyAgg')}</p>
        </>
      )}
    </Frame>
  );
}
