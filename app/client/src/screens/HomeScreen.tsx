// SC-01 ホーム（index.html の home）。
import { AVATAR_NAMES } from '../../../shared/master/avatars.ts';
import { BOARD_SIZE } from '../../../shared/board.ts';
import { useApp } from '../app-context.ts';
import { noteGain } from '../gain.ts';
import { useT } from '../i18n/index.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { Frame } from '../ui/Frame.tsx';
import { Icon } from '../ui/Icon.tsx';
import { SpeakButton } from '../ui/SpeakButton.tsx';
import { Courses, FeaturedEvent, FirstChoice, NextWhere } from './HomeParts.tsx';

/** ボーナスで増えた分を、遊ぶ画面で1回だけ知らせる */
let bonusNoted = '';

export function HomeScreen() {
  const { me, go } = useApp();
  const { t, L } = useT();
  const avatar = me.profile.avatar;
  const greet = me.bonus
    ? t(me.bonus.source === 'revisit' ? 'greetRevisit' : 'greetDay2', { n: me.bonus.amount })
    : me.visitKind === 'first' ? t('greetFirst') : t('greetAgain');
  const pos = me.board.pos + 1;
  const play = () => {
    if (me.bonus && bonusNoted !== me.today) {
      bonusNoted = me.today;
      noteGain(me.bonus.source === 'revisit' ? 'gainRevisit' : 'gainDay2');
    }
    go('play');
  };

  return (
    <Frame title={t('appName')} brand action={
      <button type="button" className="btn primary" onClick={() => go('spots')}><Icon name="pin" />{t('findSpots')}</button>
    }>
      <div className="hello">
        <div className="who">
          <div className="avatar"><Avatar id={avatar} expression={me.bonus ? 'excited' : 'happy'} size={78} talk /></div>
          <span data-testid="home-avatar-name">{L(AVATAR_NAMES[avatar])}</span>
          <button type="button" className="link" data-testid="change-avatar" onClick={() => go('avatar')}>{t('change')}</button>
        </div>
        <div className="bubble">
          <p data-testid="greet">{greet}</p>
          <SpeakButton text={greet} avatar={avatar} />
        </div>
      </div>
      <section className="cont" aria-labelledby="cont-h">
        <h2 id="cont-h" className="sr-only">{t('contTitle')}</h2>
        <div className="prog">
          <span>{t('progress', { n: pos, m: BOARD_SIZE })}</span>
          <div className="bar"><i style={{ width: `${(pos / BOARD_SIZE) * 100}%` }} /></div>
        </div>
        <button type="button" className="btn accent" onClick={play}><Icon name="dice" />{t('contPlay', { n: me.rollsLeft })}</button>
      </section>
      <NextWhere />
      <FirstChoice />
      <Courses />
      <FeaturedEvent />
      <p className="fiction">{t('fiction')}</p>
    </Frame>
  );
}
