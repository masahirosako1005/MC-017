// 画面の切り替え（ルーターは使わない。ADR-002）。起動時に利用開始（POST /api/session）を呼ぶ。
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MeState } from '../../shared/schemas.ts';
import type { SpotId } from '../../shared/master/spots.ts';
import { ApiFailure, api } from './api.ts';
import { AppContext, TABS, isTab, type AppApi, type Screen, type Tab } from './app-context.ts';
import { errorText } from './error-text.ts';
import { useT } from './i18n/index.ts';
import { FONT_SIZES, useSettings } from './settings.ts';
import { Icon, type IconName } from './ui/Icon.tsx';
import { useSpeech } from './voice/speech.ts';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { PlayScreen } from './screens/PlayScreen.tsx';
import { SpotsScreen } from './screens/SpotsScreen.tsx';
import { DetailScreen } from './screens/DetailScreen.tsx';
import { QrScreen } from './screens/QrScreen.tsx';
import { NoteScreen } from './screens/NoteScreen.tsx';
import { InviteScreen } from './screens/InviteScreen.tsx';
import { PerksScreen } from './screens/PerksScreen.tsx';
import { ProphecyScreen } from './screens/ProphecyScreen.tsx';
import { RumorScreen } from './screens/RumorScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { AvatarScreen } from './screens/AvatarScreen.tsx';

const TAB_ICONS: Readonly<Record<Tab, IconName>> = { home: 'home', spots: 'pin', play: 'dice', rumor: 'chat', perks: 'ticket' };

interface Problem { text: string; retry: (() => void) | null }

export function App() {
  const settings = useSettings();
  const { t } = useT();
  const [me, setMe] = useState<MeState | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [boot, setBoot] = useState<Problem | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [nav, setNav] = useState<{ screen: Screen; tab: Tab; stack: Screen[]; spotId: SpotId }>({ screen: 'home', tab: 'home', stack: [], spotId: 's1' });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const { credit } = useSpeech();

  useEffect(() => {
    const root = document.documentElement;
    root.lang = settings.lang;
    root.style.fontSize = FONT_SIZES[settings.size];
  }, [settings.lang, settings.size]);

  const start = useCallback(async () => {
    setBoot(null);
    try {
      const [cfg, state] = await Promise.all([
        api<{ demoMode: boolean }>('GET', '/config'),
        api<MeState>('POST', '/session', {}),
      ]);
      setDemoMode(cfg.demoMode);
      setMe(state);
    } catch (err) {
      setBoot({ text: errorText(t, err), retry: () => void start() });
    }
  }, [t]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const refresh = useCallback(async () => {
    setMe(await api<MeState>('GET', '/me'));
  }, []);

  const fail = useCallback((err: unknown, retry?: () => void) => {
    setProblem({ text: errorText(t, err), retry: retry ?? null });
    if (err instanceof ApiFailure && err.status === 409) void refresh().catch(() => undefined);
  }, [t, refresh]);

  const go = useCallback((screen: Screen, spotId?: SpotId, replace = false) => {
    setProblem(null);
    setNav((n) => {
      const next = { ...n, spotId: spotId ?? n.spotId };
      if (isTab(screen)) return { ...next, screen, tab: screen, stack: [] };
      if (n.screen === screen || replace) return { ...next, screen };
      return { ...next, screen, stack: [...n.stack, n.screen] };
    });
  }, []);

  const back = useCallback(() => {
    setProblem(null);
    setNav((n) => {
      const stack = n.stack.slice(0, -1);
      return { ...n, screen: n.stack.at(-1) ?? n.tab, stack };
    });
  }, []);

  const appApi = useMemo<AppApi | null>(() => (me ? {
    me, demoMode, screen: nav.screen, spotId: nav.spotId, go, back, setMe, refresh, toast, fail,
  } : null), [me, demoMode, nav.screen, nav.spotId, go, back, refresh, toast, fail]);

  let content: ReactNode;
  if (!appApi) {
    content = (
      <main id="view" className="boot">
        {boot ? (
          <div className="problem" role="alert">
            <p>{boot.text}</p>
            {boot.retry && <button type="button" className="btn primary sm" onClick={boot.retry}>{t('retry')}</button>}
          </div>
        ) : (
          <p className="loading" role="status">{t('loading')}</p>
        )}
      </main>
    );
  } else {
    content = (
      <AppContext.Provider value={appApi}>
        {renderScreen(nav.screen)}
        {!isTab(nav.screen) ? null : (
          <nav className="tabs" aria-label={t('menu')}>
            {TABS.map((k) => (
              <button key={k} type="button" className="tab" aria-current={nav.tab === k ? 'page' : undefined} onClick={() => go(k)}>
                <span className="pill"><Icon name={TAB_ICONS[k]} /></span>
                <span>{t(k)}</span>
              </button>
            ))}
          </nav>
        )}
      </AppContext.Provider>
    );
  }

  return (
    <div className="stage">
      <div className="phone" id="phone">
        {content}
        {problem && (
          <div className="problem floating" role="alert">
            <p>{problem.text}</p>
            <div className="row">
              {problem.retry && (
                <button type="button" className="btn primary sm" onClick={() => { const r = problem.retry; setProblem(null); r?.(); }}>{t('retry')}</button>
              )}
              <button type="button" className="btn ghost sm" onClick={() => setProblem(null)}>{t('close')}</button>
            </div>
          </div>
        )}
        {credit && <div className="credit" data-testid="voice-credit">{credit}</div>}
        <div className={`toast${toastMsg ? ' show' : ''}`} role="status" aria-live="polite">{toastMsg}</div>
      </div>
    </div>
  );
}

function renderScreen(screen: Screen): ReactNode {
  switch (screen) {
    case 'home': return <HomeScreen />;
    case 'play': return <PlayScreen />;
    case 'spots': return <SpotsScreen />;
    case 'detail': return <DetailScreen />;
    case 'qr': return <QrScreen />;
    case 'note': return <NoteScreen />;
    case 'invite': return <InviteScreen />;
    case 'prophecy': return <ProphecyScreen />;
    case 'perks': return <PerksScreen />;
    case 'rumor': return <RumorScreen />;
    case 'settings': return <SettingsScreen />;
    case 'avatar': return <AvatarScreen />;
    default: {
      const never: never = screen;
      return never;
    }
  }
}
