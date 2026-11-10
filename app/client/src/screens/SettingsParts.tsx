// SC-12 設定の部品: ライセンスと出典（AC-046）・すべての画面（WCAG 2.4.5）・デモ操作（AC-052〜055、DEMO_MODE のみ）。
import { AVATAR_IDS, AVATAR_NAMES, VOICEVOX_SPEAKERS } from '../../../shared/master/avatars.ts';
import { SPOTS, type SpotId } from '../../../shared/master/spots.ts';
import type { MeState } from '../../../shared/schemas.ts';
import { api } from '../api.ts';
import { useApp, type Screen } from '../app-context.ts';
import { noteGain } from '../gain.ts';
import { useT, type WordKey } from '../i18n/index.ts';
import { useOnce } from '../use-once.ts';
import { Icon } from '../ui/Icon.tsx';
import { showFirstChoiceAgain } from './HomeParts.tsx';

const GSI = 'https://maps.gsi.go.jp/development/ichiran.html';
const ENGINE = 'https://github.com/VOICEVOX/voicevox_engine';

function Ext({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export function Licenses() {
  const { t, L } = useT();
  return (
    <section className="card set" aria-labelledby="lic-h" data-testid="licenses">
      <h2 id="lic-h">{t('licTitle')}</h2>
      <dl className="lic">
        <dt>{t('licMap')}</dt>
        <dd><Ext href={GSI}>出典：地理院タイル</Ext>（{t('licMapText')}）</dd>
        <dt>{t('licLeaflet')}</dt>
        <dd>Leaflet（BSD-2-Clause）</dd>
        <dt>{t('licEngine')}</dt>
        <dd>{t('licEngineText')} <Ext href={ENGINE}>VOICEVOX</Ext></dd>
        <dt>{t('licVoices')}</dt>
        <dd>
          <ul className="plain">
            {AVATAR_IDS.map((id) => <li key={id}>{VOICEVOX_SPEAKERS[id].credit}（{L(AVATAR_NAMES[id])}）</li>)}
          </ul>
          {t('licUnofficial')}
        </dd>
        <dt>{t('licArt')}</dt>
        <dd>{t('licArtText')}</dd>
        <dt>{t('licOther')}</dt>
        <dd>{t('licOtherText')}</dd>
      </dl>
    </section>
  );
}

const ALL: readonly { screen: Screen; key: WordKey }[] = [
  { screen: 'home', key: 'home' }, { screen: 'spots', key: 'spots' }, { screen: 'play', key: 'play' },
  { screen: 'rumor', key: 'rumor' }, { screen: 'perks', key: 'perks' }, { screen: 'avatar', key: 'goAvatar' },
  { screen: 'prophecy', key: 'goProphecy' },
];

/** 下のメニューに無い画面にも、もう1つの行き方を用意する（WCAG 2.4.5 複数の手段） */
export function AllScreens() {
  const { go } = useApp();
  const { t } = useT();
  return (
    <nav className="card set" aria-labelledby="all-h" data-testid="all-screens">
      <h2 id="all-h">{t('allTitle')}</h2>
      <p className="muted">{t('allLead')}</p>
      <div className="alllist">
        {ALL.map((a) => (
          <button key={a.screen} type="button" className="btn ghost sm" data-testid={`all-${a.screen}`} onClick={() => go(a.screen)}>
            {t(a.key)}
          </button>
        ))}
      </div>
    </nav>
  );
}

const WEEK: readonly (readonly [string, string])[] = [['日', 'Sun'], ['月', 'Mon'], ['火', 'Tue'], ['水', 'Wed'], ['木', 'Thu'], ['金', 'Fri'], ['土', 'Sat']];

function dayLabel(day: string, L: (p: readonly [string, string]) => string, en: boolean): string {
  const w = WEEK[new Date(`${day}T00:00:00Z`).getUTCDay()] ?? WEEK[0] ?? ['', ''];
  return en ? `${day} (${L(w)})` : `${day}（${L(w)}）`;
}

export function DemoPanel() {
  const { me, setMe, toast, fail, go } = useApp();
  const { t, L, lang } = useT();
  const clockOnce = useOnce();
  const rollsOnce = useOnce();
  const demo = me.demo ?? { offsetDays: 0, hour: null, location: null };

  const setClock = async (offsetDays: number, hour: number | null) => {
    try {
      await api<MeState>('PUT', '/demo/clock', { offsetDays, hour });
      const r = await api<MeState>('POST', '/session', {});
      setMe(r);
      toast(t('demoDayToast', { d: dayLabel(r.today, L, lang === 'en') }));
    } catch (err) {
      fail(err, () => void setClock(offsetDays, hour));
    }
  };
  /** 盤を1枚目の最初に戻し、年齢などを空にして、ホームの「はじめに選んでね」を出す */
  const resetAll = async () => {
    if (!window.confirm(t('demoResetConfirm'))) return;
    try {
      const r = await api<MeState>('POST', '/demo/reset', {});
      showFirstChoiceAgain();
      setMe(r);
      go('home');
      toast(t('demoResetToast'));
    } catch (err) {
      fail(err, () => void resetAll());
    }
  };
  const setWhere = async (spotId: SpotId | null) => {
    try {
      setMe(await api<MeState>('PUT', '/demo/location', { spotId }));
      toast(t('demoWhereToast'));
    } catch (err) {
      fail(err, () => void setWhere(spotId));
    }
  };
  const addRolls = async () => {
    try {
      const r = await rollsOnce.run((requestId) => api<MeState>('POST', '/demo/rolls', { requestId, amount: 5 }));
      if (r) { setMe(r); noteGain('gainDemo'); toast(t('gainDemo')); }
    } catch (err) {
      fail(err, () => void addRolls());
    }
  };

  return (
    <section className="card set demo" aria-labelledby="demo-h" data-testid="demo-panel">
      <h2 id="demo-h">{t('demoTitle')}</h2>
      <p className="muted">{t('demoLead')}</p>
      <p className="strong" data-testid="demo-today">{t('demoToday', { d: dayLabel(me.today, L, lang === 'en'), h: me.hour })}</p>
      <div className="row">
        <button type="button" className="btn ghost sm" data-testid="demo-plus1" disabled={clockOnce.pending}
          onClick={() => void clockOnce.run(() => setClock(demo.offsetDays + 1, demo.hour))}>{t('demoPlus1')}</button>
        <button type="button" className="btn ghost sm" data-testid="demo-plus7" disabled={clockOnce.pending}
          onClick={() => void clockOnce.run(() => setClock(demo.offsetDays + 7, demo.hour))}>{t('demoPlus7')}</button>
        <button type="button" className="btn ghost sm" data-testid="demo-reset" disabled={clockOnce.pending}
          onClick={() => void clockOnce.run(resetAll)}>{t('demoReset')}</button>
      </div>
      <label htmlFor="demo-hour">{t('demoHour')}</label>
      <select id="demo-hour" data-testid="demo-hour" value={demo.hour ?? ''}
        onChange={(e) => void setClock(demo.offsetDays, e.target.value === '' ? null : Number(e.target.value))}>
        <option value="">{t('demoHourAuto')}</option>
        {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{lang === 'en' ? `${h}:00` : `${h}時`}</option>)}
      </select>
      <label htmlFor="demo-where">{t('demoWhere')}</label>
      <select id="demo-where" data-testid="demo-where" value={demo.location ?? ''}
        onChange={(e) => void setWhere(SPOTS.find((s) => s.id === e.target.value)?.id ?? null)}>
        <option value="">{t('notChosen')}</option>
        {SPOTS.map((s) => <option key={s.id} value={s.id}>{L(s.name)}</option>)}
      </select>
      <div className="row">
        <button type="button" className="btn accent sm" data-testid="demo-rolls" disabled={rollsOnce.pending} onClick={() => void addRolls()}>
          <Icon name="dice" />{t('demoRolls')}
        </button>
      </div>
    </section>
  );
}
