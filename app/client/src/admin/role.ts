// 選んだ役割と、画面の種類・言葉。役割は sessionStorage（キー admin-operator）に持つ。
import type { Operator } from '../../../shared/admin.ts';
import { isShopId, type ShopId } from '../../../shared/master/campaigns.ts';
import { spotById } from '../../../shared/master/spots.ts';

const KEY = 'admin-operator';

export type View = 'dashboard' | 'shop' | 'voices' | 'demand';

export function shopIdOf(op: Operator): ShopId | null {
  const id = op.slice(5);
  return op !== 'association' && isShopId(id) ? id : null;
}

export function operatorOfShop(id: ShopId): Operator {
  return `shop-${id}`;
}

function parseOperator(v: string | null): Operator | null {
  if (v === 'association') return v;
  if (v === null || !v.startsWith('shop-')) return null;
  const id = v.slice(5);
  return isShopId(id) ? operatorOfShop(id) : null;
}

export function loadOperator(): Operator | null {
  try {
    return parseOperator(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveOperator(op: Operator | null): void {
  try {
    if (op === null) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, op);
  } catch {
    // 保存できなくても、この画面の中では選んだ役割で動く
  }
}

export function shopName(id: ShopId): string {
  return spotById(id).name[0];
}

export function firstView(op: Operator): View {
  return op === 'association' ? 'dashboard' : 'shop';
}

export const VIEW_TITLE: Record<View, string> = {
  dashboard: 'ダッシュボード',
  shop: '店舗ダッシュボード',
  voices: 'お客さまの声',
  demand: '近くの予定と特典マス',
};

export const ASSOCIATION_MENU: readonly View[] = ['dashboard']; // 特典マスの承認機能は無い（2026-11-10 の指示）
export const SHOP_MENU: readonly View[] = ['shop', 'voices', 'demand'];
