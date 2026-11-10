// SC-12 設定（index.html の settings）。ことば・文字の大きさ・音声・デモ操作（DEMO_MODE のみ）・すべての画面・ライセンスと出典。
import { useEffect, useState } from 'react';
import { VOICEVOX_SPEAKERS } from '../../../shared/master/avatars.ts';
import { api } from '../api.ts';
import { useApp } from '../app-context.ts';
import { useT } from '../i18n/index.ts';
import { setSetting, useSettings, type Lang, type Size, type VoiceMode } from '../settings.ts';
import { Frame } from '../ui/Frame.tsx';
import { Icon } from '../ui/Icon.tsx';
import { Seg } from '../ui/Seg.tsx';
import { currentBrowserVoiceName, stopSpeech } from '../voice/speech.ts';
import { AllScreens, DemoPanel, Licenses } from './SettingsParts.tsx';

function useVoiceName(): string | null {
  const s = useSettings();
  const { me } = useApp();
  const { t } = useT();
  const [engineUp, setEngineUp] = useState<boolean | null>(null);
  const [voicesTick, setVoicesTick] = useState(0);

  useEffect(() => {
    let alive = true;
    api<{ available: boolean }>('GET', '/tts/status')
      .then((r) => { if (alive) setEngineUp(r.available); })
      .catch(() => { if (alive) setEngineUp(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined;
    const on = () => setVoicesTick((n) => n + 1);
    window.speechSynthesis.addEventListener('voiceschanged', on);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', on);
  }, []);

  if (!s.speech) return t('voiceNone');
  if (s.voice === 'auto') {
    if (engineUp === null) return null;
    return engineUp ? VOICEVOX_SPEAKERS[me.profile.avatar].credit : t('voiceDown');
  }
  void voicesTick;
  return currentBrowserVoiceName(s.lang) ?? t('voiceNone');
}

export function SettingsScreen() {
  const s = useSettings();
  const { back, demoMode } = useApp();
  const { t } = useT();
  const voiceName = useVoiceName();

  return (
    <Frame title={t('settings')} action={
      <button type="button" className="btn primary" onClick={back}><Icon name="check" size={22} />{t('doneSet')}</button>
    }>
      <p className="lead">{t('setLead')}</p>
      <section className="card set">
        <h2>{t('lang')}</h2>
        <Seg<Lang> label={t('lang')} value={s.lang} onChange={(v) => setSetting('lang', v)}
          options={[{ value: 'ja', label: '日本語', testId: 'lang-ja' }, { value: 'en', label: 'English', testId: 'lang-en' }]} />
      </section>
      <section className="card set">
        <h2>{t('size')}</h2>
        <Seg<Size> label={t('size')} value={s.size} onChange={(v) => setSetting('size', v)}
          options={[{ value: 's', label: t('sizeS'), className: 'a1' }, { value: 'm', label: t('sizeM'), className: 'a2' },
            { value: 'l', label: t('sizeL'), className: 'a3', testId: 'size-l' }]} />
      </section>
      <section className="card set">
        <h2>{t('sound')}</h2>
        <p className="muted">{t('speechHint')}</p>
        <p className="sub">{t('speech')}</p>
        <Seg<boolean> label={t('speech')} value={s.speech} onChange={(v) => { if (!v) stopSpeech(); setSetting('speech', v); }}
          options={[{ value: true, label: t('on') }, { value: false, label: t('off'), testId: 'speech-off' }]} />
        <p className="sub">{t('voice')}</p>
        <Seg<VoiceMode> label={t('voice')} value={s.voice} onChange={(v) => { stopSpeech(); setSetting('voice', v); }}
          options={[{ value: 'auto', label: t('voiceAuto'), testId: 'voice-auto' }, { value: 'browser', label: t('voiceBrowser'), testId: 'voice-browser' }]} />
        <p className="muted voicenow" data-testid="voice-now">{t('voiceNow', { name: voiceName ?? t('voiceChecking') })}</p>
        <p className="muted">{t('voiceHint')}</p>
        <p className="sub">{t('sfx')}</p>
        <Seg<boolean> label={t('sfx')} value={s.sfx} onChange={(v) => setSetting('sfx', v)}
          options={[{ value: true, label: t('on') }, { value: false, label: t('off'), testId: 'sfx-off' }]} />
      </section>
      <Licenses />
      {demoMode && <DemoPanel />}
      <AllScreens />
    </Frame>
  );
}
