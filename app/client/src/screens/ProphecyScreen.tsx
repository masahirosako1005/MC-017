// SC-09 予言と答え合わせ（R-030〜R-033、ADR-010）。表示A＝予言カード、表示B＝答え合わせ。
import { useCallback, useEffect, useRef, useState } from 'react';
import { AVATAR_NAMES } from '../../../shared/master/avatars.ts';
import { TAGS, spotById, type Tag } from '../../../shared/master/spots.ts';
import { hitRate, historyMark } from '../../../shared/prophecy.ts';
import type { Answer, MeState, Prophecy, ProphecyState, Reason } from '../../../shared/schemas.ts';
import { api } from '../api.ts';
import { useApp } from '../app-context.ts';
import { errorText } from '../error-text.ts';
import { useT, type T } from '../i18n/index.ts';
import { noteGain } from '../gain.ts';
import { useOnce } from '../use-once.ts';
import { say } from '../voice/speech.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { Frame } from '../ui/Frame.tsx';
import { Icon } from '../ui/Icon.tsx';
import { SpeakButton } from '../ui/SpeakButton.tsx';

/** QR の応答に prophecyCheck があったとき、SC-10 が印をつけてからこの画面へ移る */
let justChecked: number | null = null;
export function markChecked(prophecyId: number): void {
  justChecked = prophecyId;
}

function isTag(s: string | undefined): s is Tag {
  return (TAGS as readonly string[]).includes(s ?? '');
}

export function reasonText(t: T, r: Reason): string {
  if (r.code === 'tag') return t('r_tag', { tag: isTag(r.tag) ? t(`tag_${r.tag}`) : '' });
  return t(`r_${r.code}`);
}

function whenText(t: T, p: Prophecy): string {
  return t('when', { season: t(p.season), months: t(`months_${p.season}`), band: t(`band_${p.timeBand}`) });
}

export function ProphecyScreen() {
  const { me, go } = useApp();
  const { t, L } = useT();
  const buddyName = L(AVATAR_NAMES[me.profile.avatar]);
  const [st, setSt] = useState<ProphecyState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [checked] = useState(() => { const id = justChecked; justChecked = null; return id; });

  const load = useCallback(async () => {
    setErr(null);
    try {
      setSt(await api<ProphecyState>('GET', '/prophecy'));
    } catch (e) {
      setErr(errorText(t, e));
    }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  // 答えを待つ予言があれば表示B。答えたあとも結果を見せるため、この画面の間は表示B のまま
  const lock = useRef(false);
  if (st?.current?.status === 'visited') lock.current = true;
  if (lock.current || (checked !== null && !st && !err)) {
    return <CheckView state={st} checked={checked} onState={setSt} buddyName={buddyName} />;
  }

  const p = st?.current ?? null;
  const name = p ? L(spotById(p.spotId).name) : '';
  return (
    <Frame title={t('prophecyTitle', { name: buddyName })} action={p && (
      <button type="button" className="btn primary" onClick={() => go('detail', p.spotId)}>{t('seeSpotName', { name })}</button>
    )}>
      {err && (
        <div className="problem" role="alert"><p>{err}</p>
          <button type="button" className="btn primary sm" onClick={() => void load()}>{t('retry')}</button></div>
      )}
      {!st && !err && <p className="card loading" role="status">{t('thinking', { name: buddyName })}</p>}
      {st && !p && (
        <div className="card" data-testid="prophecy-none">
          <p>{t('prophecyNone', { name: buddyName })}</p>
          <button type="button" className="btn primary gap14" onClick={() => go('spots')}><Icon name="pin" />{t('findSpots')}</button>
        </div>
      )}
      {st && p && <CardView st={st} p={p} />}
    </Frame>
  );
}

function CardView({ st, p }: { st: ProphecyState; p: Prophecy }) {
  const { me, go } = useApp();
  const { t, L } = useT();
  const s = spotById(p.spotId);
  const line = t('prophecyBuddy', { when: whenText(t, p) });
  const answered = st.liked + st.normal;
  return (
    <>
      <div className="buddy top0">
        <div className="av"><Avatar id={me.profile.avatar} expression="excited" size={60} talk /></div>
        <div className="bubble"><p>{line}</p><SpeakButton text={line} avatar={me.profile.avatar} size={18} /></div>
      </div>
      <section className="pcard" role="group" aria-labelledby="pc-h" data-testid="prophecy-card" data-spot={p.spotId}>
        <h2 id="pc-h">{t('nextTrip')}</h2>
        <div className="pspot">
          <span className="ic"><Icon name={s.icon} size={30} /></span>
          <div><b className="pname">{L(s.name)}</b><span className="pwhen">{whenText(t, p)}</span></div>
        </div>
        <h3>{t('reasonsTitle')}</h3>
        <ul className="plain reasons">
          {p.reasons.map((r, i) => (
            <li key={i} data-code={r.code}>
              <span className="rtext">{reasonText(t, r)}</span>
              <span className="rstr">{t(`s_${r.strength}`)}</span>
              <span className={`rbar ${r.strength}`} aria-hidden="true"><i /></span>
            </li>
          ))}
        </ul>
        <button type="button" className="btn ghost sm" onClick={() => go('detail', p.spotId)}>{t('seeSpot')}<Icon name="chev" size={20} /></button>
      </section>
      <p className="muted gap10">{t('howMade')}</p>

      <h2>{t('historyTitle')}</h2>
      <div className="card" data-testid="smart">
        <p>{hitRate(st.liked, st.normal) === null ? t('hitNone') : t('hitCount', { m: answered, n: st.liked })}</p>
        <ul className="plain hist gap14" data-testid="history">
          {st.history.map((h) => (
            <li key={h.id}>
              <span>{t(h.season)}・{L(spotById(h.spotId).name)}</span>
              <span className="mark">{h.status === 'open' ? `― ${t('hist_open')}` : `${historyMark(h.answer)} ${t(h.answer === 'liked' ? 'hist_liked' : h.answer === 'normal' ? 'hist_normal' : 'hist_none')}`}</span>
            </li>
          ))}
        </ul>
      </div>

      {st.others.length > 0 && <h2>{t('othersTitle')}</h2>}
      {st.others.map((o) => (
        <button key={o.spotId} type="button" className="lrow" onClick={() => go('detail', o.spotId)}>
          <span className="ic"><Icon name={spotById(o.spotId).icon} /></span>
          <span className="grow"><b>{L(spotById(o.spotId).name)}</b>{o.reason && <span className="muted">{reasonText(t, o.reason)}</span>}</span>
          <span className="chev"><Icon name="chev" /></span>
        </button>
      ))}
    </>
  );
}

function CheckView({ state, checked, onState, buddyName }: {
  state: ProphecyState | null; checked: number | null; onState: (s: ProphecyState) => void; buddyName: string;
}) {
  const { me, setMe, go, fail } = useApp();
  const { t, L } = useT();
  const { run, pending } = useOnce();
  const [result, setResult] = useState<{ answer: Answer; st: ProphecyState } | null>(null);
  const target = useRef<Prophecy | null>(null);
  if (!target.current && state?.current?.status === 'visited') target.current = state.current;
  const p = target.current;
  const name = p ? L(spotById(p.spotId).name) : '';
  const line = t('checkBuddy', { name });
  const spoken = useRef(false);

  useEffect(() => {
    if (!p || spoken.current || checked !== p.id) return;
    spoken.current = true;
    say(line, me.profile.avatar);
  }, [p, checked, line, me.profile.avatar]);

  const send = async (answer: Answer) => {
    if (!p) return;
    try {
      const r = await run((requestId) => api<ProphecyState>('POST', `/prophecy/${p.id}/answer`, { requestId, answer }));
      if (!r) return;
      setResult({ answer, st: r });
      onState(r);
      setMe(await api<MeState>('GET', '/me'));
    } catch (err) {
      fail(err, () => void send(answer));
    }
  };

  const resText = result && (result.answer === 'liked'
    ? t('res_liked', { m: result.st.liked + result.st.normal, k: result.st.liked })
    : t(result.answer === 'normal' ? 'res_normal' : 'res_later'));

  return (
    <Frame title={t('checkTitle')} action={
      <button type="button" className="btn accent" data-testid="to-play" onClick={() => { if (p && checked === p.id) noteGain('gainProphecy'); go('play'); }}><Icon name="dice" />{t('rollNow', { n: me.rollsLeft })}</button>
    }>
      {!p && <p className="card loading" role="status">{t('thinking', { name: buddyName })}</p>}
      {p && checked === p.id && (
        <section className="card gold-card" role="status" data-testid="check-reward">
          <h2>{t('checkGot')}</h2>
          <p className="big-dice"><Icon name="dice" size={30} />{t('checkDice')}</p>
          <p className="muted">{t('checkDiceNote')}</p>
        </section>
      )}
      {p && checked !== p.id && <p className="note">{t('waiting', { name })}</p>}
      {p && (
        <>
          <div className="buddy">
            <div className="av"><Avatar id={me.profile.avatar} expression="excited" size={60} talk /></div>
            <div className="bubble"><p>{line}</p></div>
          </div>
          <h2>{t('likedQ', { name })}</h2>
          <p className="muted">{t('likedNote')}</p>
          <div className="answers" role="group" aria-label={t('likedQ', { name })}>
            {(['liked', 'normal', 'later'] as const).map((a) => (
              <button key={a} type="button" className={`btn ${a === 'liked' ? 'primary' : 'ghost'}`} data-testid={`ans-${a}`}
                disabled={pending || result !== null} onClick={() => void send(a)}>{t(`ans_${a}`)}</button>
            ))}
          </div>
          <p className="result-line" role="status" data-testid="answer-result">{resText}</p>
        </>
      )}
    </Frame>
  );
}

