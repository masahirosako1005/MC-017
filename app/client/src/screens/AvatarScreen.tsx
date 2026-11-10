// SC-02 アバター選択（R-007、AC-007・AC-008）。4枚揃わない体は「準備中」で選べない。
import { useEffect, useState } from 'react';
import { AVATAR_IDS, AVATAR_NAMES, type AvatarId } from '../../../shared/master/avatars.ts';
import type { MeState } from '../../../shared/schemas.ts';
import { api } from '../api.ts';
import { useApp } from '../app-context.ts';
import { getSettings } from '../settings.ts';
import { useT } from '../i18n/index.ts';
import { say, speak, stopSpeech } from '../voice/speech.ts';
import { useOnce } from '../use-once.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { Frame } from '../ui/Frame.tsx';
import { Icon } from '../ui/Icon.tsx';

export function AvatarScreen() {
  const { me, setMe, go, toast, fail } = useApp();
  const { t, L } = useT();
  const { run, pending } = useOnce();
  const [avail, setAvail] = useState<ReadonlySet<AvatarId> | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ id: AvatarId; available: boolean }[]>('GET', '/avatars')
      .then((r) => { if (alive) setAvail(new Set(r.filter((a) => a.available).map((a) => a.id))); })
      .catch((err: unknown) => fail(err));
    return () => { alive = false; };
  }, [fail]);

  const listen = async (id: AvatarId) => {
    stopSpeech();
    const ok = await speak(t('sampleLine', { name: L(AVATAR_NAMES[id]) }), id);
    if (!ok) toast(t(getSettings().voice === 'auto' ? 'noVoicevox' : 'noVoice'));
  };

  const pick = async (id: AvatarId) => {
    if (avail && !avail.has(id)) { toast(t('preparingToast')); return; }
    try {
      const r = await run(() => api<MeState>('PATCH', '/me/profile', { avatar: id }));
      if (!r) return;
      setMe(r);
      const line = t('pickedToast', { name: L(AVATAR_NAMES[id]) });
      toast(line);
      say(line, id);
      go('home');
    } catch (err) {
      fail(err, () => void pick(id));
    }
  };

  return (
    <Frame title={t('avatarTitle')}>
      <p className="lead">{t('avatarLead')}</p>
      {!avail ? <p className="loading" role="status">{t('loading')}</p> : (
        <div className="avgrid">
          {AVATAR_IDS.map((id) => {
            const on = avail.has(id);
            const now = me.profile.avatar === id;
            return (
              <div key={id} className="avwrap">
              <button type="button" className={`avcard${now ? ' now' : ''}${on ? '' : ' off'}`} data-testid={`pick-${id}`}
                aria-pressed={now} aria-disabled={on ? undefined : true} disabled={pending} onClick={() => void pick(id)}>
                <Avatar id={id} size={96} />
                <b>{L(AVATAR_NAMES[id])}</b>
                <span className="muted">{t(`intro_${id}`)}</span>
                {now && <span className="chip gold"><Icon name="check" size={14} sw={3} />{t('nowBuddy')}</span>}
                {!on && <span className="chip gray">{t('preparing')}</span>}
              </button>
              <button type="button" className="btn avlisten" data-testid={`listen-${id}`} 
                aria-label={t('listenLabel', { name: L(AVATAR_NAMES[id]) })} onClick={() => void listen(id)}>
                {t('listen')}
              </button>
              </div>
            );
          })}
        </div>
      )}
      <p className="muted gap12">{t('avatarNote')}</p>
    </Frame>
  );
}


