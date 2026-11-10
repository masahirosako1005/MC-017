// SC-11 ひとこと（R-014）。1〜100字。本文は React の通常の描画だけで扱う。
import { useRef, useState } from 'react';
import { spotById } from '../../../shared/master/spots.ts';
import { charCount, type TriggerResult } from '../../../shared/schemas.ts';
import { api } from '../api.ts';
import { useApp } from '../app-context.ts';
import { useT } from '../i18n/index.ts';
import { noteGain } from '../gain.ts';
import { beep } from '../sfx.ts';
import { useOnce } from '../use-once.ts';
import { Buddy, PlusBadge } from '../ui/Buddy.tsx';
import { Frame } from '../ui/Frame.tsx';
import { Icon } from '../ui/Icon.tsx';

export const NOTE_MAX = 100;

export function NoteScreen() {
  const { spotId, go, refresh, toast, fail } = useApp();
  const { t, L } = useT();
  const s = spotById(spotId);
  const [text, setText] = useState('');
  const [empty, setEmpty] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const { run, pending } = useOnce();

  const send = async () => {
    if (!text.trim()) {
      setEmpty(true);
      area.current?.focus();
      return;
    }
    try {
      const r = await run((requestId) => api<TriggerResult>('POST', `/spots/${spotId}/notes`, { requestId, text }));
      if (!r) return;
      beep('ok');
      toast(t(r.granted ? 'noteThanksDice' : 'noteThanks'));
      await refresh();
      if (r.granted) noteGain('gainNote');
      go('play');
    } catch (err) {
      fail(err, () => void send());
    }
  };

  return (
    <Frame title={t('noteTitle')} action={
      <button type="button" className="btn primary" data-testid="send" disabled={pending} onClick={() => void send()}>
        <Icon name="pen" size={22} />{t('send')}<PlusBadge label={t('plusOne')} />
      </button>
    }>
      <p className="lead gap6">{L(s.name)}</p>
      <h2 className="gap6"><label htmlFor="note">{t('noteLead')}</label></h2>
      <p className="gap12"><span className="chip gold"><Icon name="dice" size={14} sw={2.5} />{t('noteDice')}</span></p>
      <textarea id="note" ref={area} data-testid="note" value={text} maxLength={NOTE_MAX * 2} placeholder={t('notePh')}
        aria-describedby={`note-c note-p${empty ? ' note-e' : ''}`} aria-invalid={empty || charCount(text) > NOTE_MAX}
        onChange={(e) => {
          const v = e.target.value;
          setText(charCount(v) > NOTE_MAX ? [...v].slice(0, NOTE_MAX).join('') : v);
          setEmpty(false);
        }} />
      <div className="count" id="note-c" aria-live="polite">{t('count', { n: charCount(text) })}</div>
      {empty && <p className="err" id="note-e" role="alert">{t('noteEmpty')}</p>}
      <div className="note gap14" id="note-p"><Icon name="info" size={20} /><span>{t('notePriv')}</span></div>
      <Buddy text={t('noteBuddy')} />
    </Frame>
  );
}
