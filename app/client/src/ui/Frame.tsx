// 画面の枠（index.html の .top・main・.act）。下のメニューは App が出す。
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { isTab, useApp } from '../app-context.ts';
import { useT } from '../i18n/index.ts';
import { Icon } from './Icon.tsx';

interface Props {
  title: string;
  brand?: boolean;
  flush?: boolean;
  action?: ReactNode;
  children: ReactNode;
}

export function Frame({ title, brand = false, flush = false, action, children }: Props) {
  const { screen, spotId, go, back } = useApp();
  const { t } = useT();
  const sub = !isTab(screen);
  const main = useRef<HTMLElement>(null);

  // 子（盤の駒へのスクロールなど）の useEffect より先に上へ戻すため layout effect にする
  useLayoutEffect(() => {
    main.current?.scrollTo({ top: 0 });
  }, [screen, spotId]);

  return (
    <>
      <header className={`top${sub ? ' sub' : ''}`}>
        {sub && (
          <button type="button" className="ib" aria-label={t('back')} onClick={back}>
            <Icon name="back" sw={2.5} />
          </button>
        )}
        {brand ? (
          <h1 className="brand">
            <span className="mark"><Icon name="dice" size={20} sw={2.2} /></span>
            <span>{title}</span>
          </h1>
        ) : (
          <h1>{title}</h1>
        )}
        <button type="button" className="ib" aria-label={t('settings')} aria-current={screen === 'settings' ? 'page' : undefined}
          onClick={() => (screen === 'settings' ? back() : go('settings'))}>
          <Icon name="gear" />
        </button>
      </header>
      <main ref={main} className={flush ? 'flush' : undefined} id="view">
        {children}
      </main>
      {action && <div className="act">{action}</div>}
    </>
  );
}
