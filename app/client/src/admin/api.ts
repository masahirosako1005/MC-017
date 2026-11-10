// 運営向け API の呼び出し。同じオリジンの /api/admin だけを呼ぶ。役割は X-Operator で送る（ログインは無い）。
import type {
  AdminSummary, CampaignBody, CampaignView, DemandView, Operator, PERIODS, ShopSummary, VoicesView,
} from '../../../shared/admin.ts';
import type { ShopId } from '../../../shared/master/campaigns.ts';

export type Period = (typeof PERIODS)[number];
export type VoiceFilter = 'all' | 'unread' | 'read';
export type Context = 'load' | 'create' | 'confirm';

export class AdminFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function codeOf(v: unknown): string {
  if (typeof v !== 'object' || v === null || !('error' in v)) return 'unknown';
  const e = v.error;
  if (typeof e !== 'object' || e === null || !('code' in e)) return 'unknown';
  return typeof e.code === 'string' ? e.code : 'unknown';
}

async function call<T>(op: Operator, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Operator': op };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`/api/admin${path}`, {
      method,
      headers,
      body: body === undefined ? null : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new AdminFailure(0, 'network');
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new AdminFailure(res.status, codeOf(data));
  return data as T;
}

/** 失敗をやさしい日本語にする。スタックや内部の情報は出さない */
export function errorText(e: unknown, ctx: Context): string {
  const status = e instanceof AdminFailure ? e.status : -1;
  if (status === 0) return 'つながりませんでした。サーバーが動いているか確かめて、もう一度ためしてください。';
  if (status === 404) return 'この役割では使えない操作です。「役割を変える」から選び直してください。';
  if (status === 400) {
    return ctx === 'create'
      ? '入力を確かめてください。開始日は明日以降、期間は開始から7〜30日にしてください。'
      : '読み込みの条件がまちがっています。画面を開き直してください。';
  }
  if (status === 409) {
    if (ctx === 'create') return 'いまは作れません。対象の人数が足りなくなりました。画面を読み直してください。';
    return 'すでに別の結果になっています。一覧を読み直してください。';
  }
  return 'うまくいきませんでした。少し待って、もう一度ためしてください。';
}

const q = encodeURIComponent;

export const getSummary = (op: Operator, p: Period) => call<AdminSummary>(op, 'GET', `/summary?days=${q(p)}`);
export const getShopSummary = (op: Operator, shop: ShopId, p: Period) =>
  call<ShopSummary>(op, 'GET', `/shops/${q(shop)}/summary?days=${q(p)}`);
export const getDemand = (op: Operator, shop: ShopId) => call<DemandView>(op, 'GET', `/shops/${q(shop)}/demand`);
export const getShopCampaigns = (op: Operator, shop: ShopId) =>
  call<CampaignView[]>(op, 'GET', `/shops/${q(shop)}/campaigns`);
export const createCampaign = (op: Operator, shop: ShopId, body: CampaignBody) =>
  call<CampaignView>(op, 'POST', `/shops/${q(shop)}/campaigns`, body);
export const getVoices = (op: Operator, shop: ShopId, show: VoiceFilter) =>
  call<VoicesView>(op, 'GET', `/shops/${q(shop)}/voices?show=${q(show)}`);
export const confirmVoice = (op: Operator, shop: ShopId, noteId: number) =>
  call<VoicesView>(op, 'POST', `/shops/${q(shop)}/voices/${noteId}/confirm`, {});
