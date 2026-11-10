// 振った結果のカードと相棒のセリフ（SC-05 #5・#6）。セリフは操作のあとの結果なので、読み上げ「あり」なら自動で読む（方向性 §17.3）。
import { useEffect } from 'react';
import { couponWithShop } from '../../../shared/master/coupons.ts';
import { spotById } from '../../../shared/master/spots.ts';
import type { RollResult } from '../../../shared/schemas.ts';
import { useApp } from '../app-context.ts';
import { useT, type T } from '../i18n/index.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { Icon } from '../ui/Icon.tsx';
import { say } from '../voice/speech.ts';

type Lx = (p: readonly [string, string]) => string;

function landedText(t: T, L: Lx, r: RollResult): string {
  const l = r.landed;
  switch (l.kind) {
    case 'gift': return t('landGiftC', { c: L(couponWithShop(l.coupon)) });
    case 'shop': return t('landShopC', { c: L(couponWithShop(l.coupon)) });
    case 'spot': return t('landSpot', { s: L(spotById(l.spotId).name) });
    case 'season': return t('landSeason', { s: L(spotById(l.spotId).ev) });
    case 'goal': return t('landGoalC', { c: L(couponWithShop(l.coupon)), n: l.nextBoard });
    case 'again': return t('landAgain');
    case 'normal': return t('landNormal');
  }
}

export function cheerLine(t: T, L: Lx, r: RollResult): string {
  const l = r.landed;
  if (l.kind === 'goal') return t('cheerGoal');
  if (l.kind === 'again') return t('cheerAgain');
  if (l.kind === 'gift') return t('cheerGift', { c: L(couponWithShop(l.coupon)) });
  if (l.kind === 'shop') return t('cheerShop', { c: L(couponWithShop(l.coupon)) });
  if (l.kind === 'spot' || l.kind === 'season') return t('cheerSpot', { s: L(spotById(l.spotId).name) });
  if (r.near) return t('cheerNear', { n: r.near.steps });
  return t(r.face % 3 === 0 ? 'cheer1' : r.face % 3 === 1 ? 'cheer2' : 'cheer3');
}

/** part: 'card'＝結果のカード、'buddy'＝相棒と一言（盤の中央に重ねる）。読み上げは 'buddy' だけが行う */
export function RollOutcome({ result, part }: { result: RollResult; part: 'card' | 'buddy' }) {
  const { me } = useApp();
  const { t, L } = useT();
  const l = result.landed;
  const expression = l.kind === 'gift' || l.kind === 'goal' || l.kind === 'shop' || l.kind === 'again' ? 'excited' : 'happy';
  const line = cheerLine(t, L, result);
  const avatar = me.profile.avatar;

  useEffect(() => { if (part === 'buddy') say(line, avatar); }, [line, avatar, part]);

  if (part === 'buddy') {
    return (
      <div className="buddy big" data-testid="cheer">
        <div className="av"><Avatar id={avatar} expression={expression} size={120} talk /></div>
        <div className="bubble"><p>{line}</p></div>
      </div>
    );
  }
  return (
    <>
      <div className="result" data-kind={l.kind}>
        <b>{t('moved', { n: result.to - result.from })}</b>
        <p>{t('diceFace', { n: result.face })}・{t('atSquare', { n: result.to + 1 })}</p>
        <p>{landedText(t, L, result)}</p>
        {result.near && <p className="strong">{t(result.near.kind === 'goal' ? 'nearGoal' : 'nearGift', { n: result.near.steps })}</p>}
      </div>
    </>
  );
}




/** 振ったあと、下の操作エリアに出す一言とボタン。盤が縦に長く、結果のカードが画面の外になるため、いつも見える場所にも置く */
export function RollQuick({ result }: { result: RollResult }) {
  const { go } = useApp();
  const { t, L } = useT();
  const l = result.landed;
  const perk = l.kind === 'gift' || l.kind === 'goal' || l.kind === 'shop';
  const spot = l.kind === 'spot' || l.kind === 'season';
  return (
    <div className="quick" data-testid="roll-quick" data-kind={l.kind}>
      <p className="hint" aria-hidden="true">{landedText(t, L, result)}</p>
      {perk && <button type="button" className="btn accent sm" onClick={() => go('perks')}><Icon name="gift" />{t('seePerk')}</button>}
      {spot && (
        <button type="button" className="btn ghost sm" data-testid="see-spot-detail" onClick={() => go('detail', l.spotId)}>
          <Icon name="pin" />{t('seeDetailName', { s: L(spotById(l.spotId).name) })}
        </button>
      )}
    </div>
  );
}

