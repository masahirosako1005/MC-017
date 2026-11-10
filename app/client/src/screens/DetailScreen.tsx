// SC-04 スポット詳細（index.html の detail）。QR・ひとこと・誘う の状態（R-012〜R-016）。
import { spotById } from '../../../shared/master/spots.ts';
import { dummyVoices, nearbyShops } from '../../../shared/master/voices.ts';
import type { Trigger } from '../../../shared/schemas.ts';
import { useApp, type Screen } from '../app-context.ts';
import { useT } from '../i18n/index.ts';
import { PlusBadge } from '../ui/Buddy.tsx';
import { Frame } from '../ui/Frame.tsx';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { PlanButton } from './PlanButton.tsx';

export function DetailScreen() {
  const { me, spotId, go, toast } = useApp();
  const { t, L } = useT();
  const s = spotById(spotId);
  const done = new Set<Trigger>(me.doneToday[spotId] ?? []);

  const doCard = (kind: Trigger, icon: IconName, label: string, screen: Screen) => {
    const isDone = done.has(kind);
    return (
      <button type="button" className={`do${isDone ? ' done' : ''}`} data-testid={`do-${kind}`} data-done={isDone ? '1' : '0'}
        onClick={() => (isDone ? toast(t('doneToday')) : go(screen))}>
        <div className="ic"><Icon name={icon} size={26} /></div>
        <div className="grow">
          <b>{label}</b>
          {isDone
            ? <span className="chip gray"><Icon name="check" size={14} sw={3} />{t('doneToday')}</span>
            : <span className="chip gold">{t('plusDice')}</span>}
        </div>
        <span className="chev"><Icon name="chev" /></span>
      </button>
    );
  };

  const action = done.has('qr') ? (
    <button type="button" className="btn accent" data-testid="qr" onClick={() => go('play')}><Icon name="dice" />{t('toPlay')}</button>
  ) : (
    <button type="button" className="btn primary" data-testid="qr" onClick={() => go('qr')}>
      <Icon name="qr" />{t('qrRead')}<PlusBadge label={t('plusOne')} />
    </button>
  );

  return (
    <Frame title={L(s.name)} action={action}>
      <div className="hero">
        <i className="dot d1" /><i className="dot d2" />
        <div className="chips">
          <span className="chip">{L(s.cat)}</span>
          <span className="chip gold"><Icon name={s.season} size={14} sw={2.5} />{t(s.season)}</span>
        </div>
        <div className="big"><Icon name={s.icon} size={48} sw={1.8} /></div>
      </div>
      <div className="card evcard">
        <span className="k">{t('eventFic')}</span>
        <b>{L(s.ev)}</b>
        <p>{L(s.short)}</p>
        <div className="meta">
          <span className={`chip ${s.stepFree ? 'gold' : 'gray'}`} data-testid="steps">{t(s.stepFree ? 'stepLess' : 'hasSteps')}</span>
        </div>
      </div>
      {s.real && <p className="muted gap10">{t('realNote')}</p>}
      {s.kind !== 'shop' && <PlanButton spotId={spotId} />}

      <h2>{t('doTitle')}</h2>
      {doCard('note', 'pen', t('noteCard'), 'note')}
      {doCard('invite', 'plane', t('inviteCard'), 'invite')}

      <h2>{t('nearShops')}</h2>
      <div className="card" data-testid="near-shops">
        <p className="muted gap6">{t('nearHint')}</p>
        {nearbyShops(spotId).map(({ spot, meters }) => (
          <button key={spot.id} type="button" className="shop" data-spot={spot.id} onClick={() => go('detail', spot.id)}>
            <div className="ic"><Icon name={spot.icon} size={22} /></div>
            <div className="grow"><b>{L(spot.name)}</b><div className="muted">{L(spot.cat)}</div></div>
            <span className="chip">{t('meters', { n: meters })}</span>
          </button>
        ))}
        <p className="muted small">{t('nearDist')}</p>
      </div>

      <h2>{t('voices')}</h2>
      <div className="card" data-testid="voices">
        <p className="muted">{t('dummySample')}</p>
        {dummyVoices(spotId).map((v, i) => (
          <div key={i} className="voice">
            <span className="chip">{t('who', { a: t(`age-${v.age}`), c: t(`comp-${v.companion}`) })}</span>
            <p>{L(v.text)}</p>
          </div>
        ))}
      </div>
      <p className="fiction">{t('fiction')}</p>
    </Frame>
  );
}
