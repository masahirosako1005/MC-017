// SC-08 友達を誘う（LINE の見本。外へは送らない。R-015）
import { spotById } from '../../../shared/master/spots.ts';
import type { TriggerResult } from '../../../shared/schemas.ts';
import { api } from '../api.ts';
import { useApp } from '../app-context.ts';
import { useT } from '../i18n/index.ts';
import { noteGain } from '../gain.ts';
import { beep } from '../sfx.ts';
import { useOnce } from '../use-once.ts';
import { Buddy, PlusBadge } from '../ui/Buddy.tsx';
import { Frame } from '../ui/Frame.tsx';
import { Icon } from '../ui/Icon.tsx';

export function InviteScreen() {
  const { spotId, go, refresh, toast, fail } = useApp();
  const { t, L } = useT();
  const s = spotById(spotId);
  const { run, pending } = useOnce();

  const send = async () => {
    try {
      const r = await run((requestId) => api<TriggerResult>('POST', `/spots/${spotId}/invites`, { requestId }));
      if (!r) return;
      beep('ok');
      toast(t(r.granted ? 'inviteThanksDice' : 'inviteThanks'));
      await refresh();
      if (r.granted) noteGain('gainInvite');
      go('play');
    } catch (err) {
      fail(err, () => void send());
    }
  };

  return (
    <Frame title={t('inviteTitle')} action={
      <button type="button" className="btn primary" data-testid="invite-send" disabled={pending} onClick={() => void send()}>
        <Icon name="plane" size={22} />{t('inviteSend')}<PlusBadge label={t('plusOne')} />
      </button>
    }>
      <p className="lead gap6">{t('inviteLead')}</p>
      <div className="chat">
        <div className="ch">
          <div className="av"><Icon name="chat" size={20} /></div>
          <span>{t('friend')}</span>
          <span className="chip gray tag">{t('lineMock')}</span>
        </div>
        <div className="cb">
          <div className="msg">
            {t('inviteMsg')}
            <div className="sp">
              <div className="ic"><Icon name={s.icon} size={22} /></div>
              <div><b>{L(s.name)}</b><span className="muted">{L(s.ev)}</span></div>
            </div>
          </div>
          <span className="sent">{t('notSent')}</span>
        </div>
      </div>
      <div className="note gap16"><Icon name="info" size={20} /><span>{t('inviteMock')}</span></div>
      <Buddy text={t('inviteBuddy')} />
    </Frame>
  );
}
