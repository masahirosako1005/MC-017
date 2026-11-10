// SC-01 ホームの部品: 次はどこ？・はじめに選んでね・今日のおすすめコース・注目のイベント。
import { useEffect, useRef, useState } from 'react';
import { seasonOf } from '../../../shared/dates.ts';
import { AVATAR_NAMES } from '../../../shared/master/avatars.ts';
import { coursesFor } from '../../../shared/master/courses.ts';
import { SPOTS, spotById } from '../../../shared/master/spots.ts';
import { AGES, COMPANIONS, type MeState, type ProfileBody, type ProphecyState } from '../../../shared/schemas.ts';
import { api } from '../api.ts';
import { useApp } from '../app-context.ts';
import { useT } from '../i18n/index.ts';
import { useOnce } from '../use-once.ts';
import { Icon } from '../ui/Icon.tsx';

export function NextWhere() {
  const { me, go } = useApp();
  const { t, L } = useT();
  const [st, setSt] = useState<ProphecyState | null>(null);
  useEffect(() => {
    let alive = true;
    api<ProphecyState>('GET', '/prophecy').then((r) => { if (alive) setSt(r); }).catch(() => undefined);
    return () => { alive = false; };
  }, [me.today]);
  const name = L(AVATAR_NAMES[me.profile.avatar]);
  const p = st?.current ?? null;
  const lead = !st ? t('nextWhereLead', { name })
    : p ? (p.status === 'open' && p.createdDay < me.today && me.visitKind === 'revisit'
      ? t('nextWait', { s: L(spotById(p.spotId).name) })
      : t('nextIs', { season: t(p.season), band: t(`band_${p.timeBand}`), s: L(spotById(p.spotId).name) }))
      : t('nextNone', { name });
  return (
    <section className="card next" aria-labelledby="next-h" data-testid="next-where">
      <h2 id="next-h">{t('nextWhere')}</h2>
      <p className="muted" data-testid="next-lead">{lead}</p>
      {(!st || p) && (
        <button type="button" className="btn ghost sm gap10" onClick={() => go('prophecy')}><Icon name="crystal" />{t('seeProphecy')}</button>
      )}
    </section>
  );
}

/** 端末で最初にホームを開いたときだけ出す。印は localStorage（ページを開いている間は出し続け、次に開いたときから出さない） */
const FIRST_KEY = 'tabi.firstChoiceSeen';
let firstChoiceShown: boolean | null = null;
function shouldShowFirstChoice(): boolean {
  if (firstChoiceShown !== null) return firstChoiceShown;
  try {
    firstChoiceShown = localStorage.getItem(FIRST_KEY) === null;
    if (firstChoiceShown) localStorage.setItem(FIRST_KEY, '1');
  } catch {
    firstChoiceShown = true; // localStorage が使えないときは、このページの間だけ出す
  }
  return firstChoiceShown;
}

let scrollToFirst = false;
/** デモの「もとに戻す」用: 次にホームを開いたとき、はじめに選んでねを出して、そこまで画面を動かす */
export function showFirstChoiceAgain(): void {
  firstChoiceShown = true;
  scrollToFirst = true;
}

/** はじめに選んでね（R-002）。選ぶとすぐ保存し、画面は移らない。出すのは最初の1回だけ */
export function FirstChoice() {
  const { me, setMe, fail, toast } = useApp();
  const { t } = useT();
  const { run, pending } = useOnce();
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!scrollToFirst || !sectionRef.current) return;
    scrollToFirst = false;
    sectionRef.current.scrollIntoView({ block: 'start' });
    sectionRef.current.querySelector('select')?.focus();
  }, []);
  const save = async (body: ProfileBody) => {
    try {
      const r = await run(() => api<MeState>('PATCH', '/me/profile', body));
      if (r) { setMe(r); toast(t('savedToast')); }
    } catch (err) {
      fail(err, () => void save(body));
    }
  };
  const { age, companion, stepLess } = me.profile;
  if (!shouldShowFirstChoice()) return null;
  return (
    <section aria-labelledby="first-h" ref={sectionRef}>
      <h2 id="first-h">{t('firstTitle')}</h2>
      <div className="card">
        <p className="muted">{t('firstHint')}</p>
        <div className="sel">
          <div>
            <label htmlFor="age">{t('ageL')}</label>
            <select id="age" data-testid="age" value={age ?? ''} disabled={pending}
              onChange={(e) => { const v = AGES.find((a) => a === e.target.value) ?? null; void save({ age: v }); }}>
              <option value="">{t('notChosen')}</option>
              {AGES.map((a) => <option key={a} value={a}>{t(`age-${a}`)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="comp">{t('compL')}</label>
            <select id="comp" data-testid="companion" value={companion ?? ''} disabled={pending}
              onChange={(e) => { const v = COMPANIONS.find((c) => c === e.target.value) ?? null; void save({ companion: v }); }}>
              <option value="">{t('notChosen')}</option>
              {COMPANIONS.map((c) => <option key={c} value={c}>{t(`comp-${c}`)}</option>)}
            </select>
          </div>
        </div>
        <button type="button" className="chipbtn gap12" aria-pressed={stepLess} data-testid="step-less" disabled={pending}
          onClick={() => void save({ stepLess: !stepLess })}>
          {stepLess && <Icon name="check" size={18} sw={3} />}{t('stepLess')}
        </button>
      </div>
    </section>
  );
}

/** 今日のおすすめコース（R-004）。段差少なめを選ぶと段差のあるコースを出さない */
export function Courses() {
  const { me } = useApp();
  const { t, L } = useT();
  const stepLess = me.profile.stepLess;
  return (
    <section aria-labelledby="course-h">
      <h2 id="course-h">{t('courseTitle')}</h2>
      {stepLess && <p className="muted gap12">{t('courseStepNote')}</p>}
      <ul className="plain" data-testid="courses">
        {coursesFor(stepLess).map((c) => (
          <li key={c.id} className="card course" data-course={c.id}>
            <div className="ic"><Icon name={c.icon} size={30} /></div>
            <div>
              <b>{L(c.name)}</b>
              <div className="meta">
                <span className="chip">{t('hours', { n: c.hours })}</span>
                <span className="chip">{t('walk', { n: c.km })}</span>
                {c.stepFree ? <span className="chip gold">{t('stepLess')}</span> : <span className="chip gray">{t('hasSteps')}</span>}
                <span className="chip">{t('rest', { n: c.rest })}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 注目のイベント: アプリ内の今日の季節のイベント1つ */
export function FeaturedEvent() {
  const { me, go } = useApp();
  const { t, L } = useT();
  const season = seasonOf(me.today);
  const ev = SPOTS.find((s) => s.season === season);
  if (!ev) return null;
  return (
    <section aria-labelledby="ev-h">
      <h2 id="ev-h">{t('eventTitle')}</h2>
      <button type="button" className="event" data-testid="featured" data-spot={ev.id} onClick={() => go('detail', ev.id)}>
        <div className="ic"><Icon name={ev.icon} size={32} /></div>
        <div className="grow">
          <span className="chip gold">{t(season)}</span>
          <b className="evname">{L(ev.ev)}</b>
          <span className="muted">{L(ev.name)}</span>
        </div>
        <span className="chev"><Icon name="chev" /></span>
      </button>
    </section>
  );
}

