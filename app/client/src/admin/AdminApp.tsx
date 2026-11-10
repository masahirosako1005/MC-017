// 運営向け画面の入れ物（役割の選択から各画面へ）。ルーターは入れず、状態 view で切り替える。
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Operator } from '../../../shared/admin.ts';
import { DashboardScreen } from './DashboardScreen.tsx';
import { DemandScreen } from './DemandScreen.tsx';
import { RoleScreen } from './RoleScreen.tsx';
import { ShopScreen } from './ShopScreen.tsx';
import { VoicesScreen } from './VoicesScreen.tsx';
import {
  ASSOCIATION_MENU, SHOP_MENU, VIEW_TITLE, firstView, loadOperator, saveOperator, shopIdOf, shopName, type View,
} from './role.ts';

function roleName(op: Operator): string {
  const shop = shopIdOf(op);
  return shop === null ? '観光協会' : `店舗：${shopName(shop)}`;
}

function Screen({ op, view, go }: { op: Operator; view: View; go: (v: View) => void }): ReactNode {
  const shop = shopIdOf(op);
  if (shop === null) return <DashboardScreen op={op} />;
  if (view === 'voices') return <VoicesScreen op={op} shop={shop} />;
  if (view === 'demand') return <DemandScreen op={op} shop={shop} />;
  return <ShopScreen op={op} shop={shop} go={go} />;
}

function Menu({ op, view, go }: { op: Operator; view: View; go: (v: View) => void }) {
  const menu = shopIdOf(op) === null ? ASSOCIATION_MENU : SHOP_MENU;
  return (
    <nav className="side" aria-label="運営メニュー" data-testid="admin-nav">
      <ul>
        {menu.map((v) => (
          <li key={v}>
            <button type="button" className="navbtn" data-testid={`nav-${v}`} aria-current={view === v ? 'page' : undefined} onClick={() => go(v)}>
              {VIEW_TITLE[v]}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AdminApp() {
  const [op, setOp] = useState<Operator | null>(loadOperator);
  const [view, setView] = useState<View>(() => {
    const o = loadOperator();
    return o === null ? 'dashboard' : firstView(o);
  });
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  // 画面を替えたら本文へフォーカスを移す（キーボードと読み上げの利用者が迷わないように）
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus();
  }, [op, view]);

  function pick(next: Operator | null) {
    saveOperator(next);
    setOp(next);
    if (next !== null) setView(firstView(next));
  }

  return (
    <div className="admin">
      <a className="skip" href="#main">本文へ</a>
      <header className="top">
        <p className="brand">名古屋すごろく旅 運営向け</p>
        <p className="role" data-testid="role-chip">{op === null ? '役割をえらんでください' : roleName(op)}</p>
        <span className="sp" />
        {op === null ? null : (
          <button type="button" className="toplink" data-testid="role-change" onClick={() => pick(null)}>役割を変える</button>
        )}
      </header>
      <div className="wrap">
        {op === null ? null : <Menu op={op} view={view} go={setView} />}
        <main id="main" ref={main} tabIndex={-1}>
          {op === null ? <RoleScreen onPick={pick} /> : <Screen key={`${op}/${view}`} op={op} view={view} go={setView} />}
        </main>
      </div>
    </div>
  );
}
