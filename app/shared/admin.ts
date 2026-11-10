// 運営向け（U-09〜U-12）の入力スキーマと応答の型。未知キーは z.strictObject で拒否（ADR-004）。
import { z } from 'zod';
import { requestIdSchema, type Age, type Companion } from './schemas.ts';
import { KINDS, SHOP_IDS, type CampaignKind, type ShopId } from './master/campaigns.ts';
import type { Pair, SpotId } from './master/spots.ts';

export const OPERATORS = ['association', 'shop-s8', 'shop-s9', 'shop-s11'] as const;
export type Operator = (typeof OPERATORS)[number];
export const operatorSchema = z.enum(OPERATORS);

/** 店の役割から店の ID を取り出す。観光協会は null */
export function shopOf(op: Operator): ShopId | null {
  return op === 'association' ? null : (op.slice(5) as ShopId);
}

export const shopParamsSchema = z.strictObject({ shopId: z.enum(SHOP_IDS) });
export const campaignParamsSchema = z.strictObject({ id: z.string().regex(/^[1-9][0-9]{0,8}$/).transform(Number) });
export const noteParamsSchema = z.strictObject({ shopId: z.enum(SHOP_IDS), noteId: z.string().regex(/^[1-9][0-9]{0,8}$/).transform(Number) });

export const PERIODS = ['7', '28', '90', 'all'] as const;
export const summaryQuerySchema = z.strictObject({ days: z.enum(PERIODS).default('28') });
export const campaignListQuerySchema = z.strictObject({ status: z.enum(['pending', 'approved', 'rejected']).optional() });
export const voicesQuerySchema = z.strictObject({ show: z.enum(['all', 'unread', 'read']).default('all') });

const dayText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), { message: 'bad day' });

/** 店の名前の入力は無い。shop は URL の :shopId だけ（自分の店だけ、ADR-024） */
export const campaignBodySchema = z.strictObject({
  requestId: requestIdSchema,
  kind: z.enum(KINDS),
  itemKey: z.string().regex(/^[a-z0-9]{1,16}$/).nullable(),
  value: z.int().min(1).max(1000).nullable(),
  starts: dayText,
  ends: dayText,
});
export type CampaignBody = z.infer<typeof campaignBodySchema>;

export const REJECT_REASONS = ['unclear', 'dates', 'other'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];
export const rejectBodySchema = z.strictObject({ reason: z.enum(REJECT_REASONS) });

// ---- 応答 ----
/** 5人未満は hidden（value は null） */
export interface CountM { value: number | null; hidden: boolean }
/** 割合（%）。母数が5未満は hidden、30未満は reference（参考） */
export interface RateM { percent: number | null; den: number | null; hidden: boolean; reference: boolean }
export interface Pairing<T> { now: T; prev: T }

export interface PeriodInfo { days: number | null; from: string; to: string }

export interface AdminSummary {
  period: PeriodInfo;
  /** 期間の終わりは、記録のある最後の日（【仮定】） */
  k01: Pairing<CountM>;
  k02: Pairing<RateM>;
  k03: Pairing<RateM>;
  k07: Pairing<RateM>;
  funnel: { key: 'came' | 'trigger' | 'rolled' | 'reason' | 'revisit'; count: CountM }[];
  /** 7日ごとの来た人数と、そのうち再訪した人数（期間の最初の日から数える） */
  weekly: { from: string; to: string; users: CountM; revisitors: CountM }[];
  /** 曜日ごとの来た回数（日=0〜土=6。同じ人が別の日に来たら別に数える） */
  weekdays: { dow: number; visits: CountM }[];
  /** 年代ごとの利用者数。年代を選んでいない人は age が null */
  ages: { age: Age | null; users: CountM }[];
  /** 誰と来たか別の利用者数。選んでいない人は companion が null */
  companions: { companion: Companion | null; users: CountM }[];
  /** スポットごとの「次回再訪の予定」: 次に行く予定を入れた人と、LINE で友だちを誘った人（期間内。全スポットを並べる） */
  spotPlans: { spotId: SpotId; planners: CountM; inviters: CountM }[];
  insight: { id: string; text: string } | null;
}

export type CampaignStatus = 'pending' | 'approved' | 'rejected';
export type CampaignPhase = 'pending' | 'rejected' | 'scheduled' | 'running' | 'ended';
export interface CampaignView {
  id: number;
  shopId: ShopId;
  kind: CampaignKind;
  label: Pair;
  starts: string;
  ends: string;
  status: CampaignStatus;
  phase: CampaignPhase;
  rejectReason: RejectReason | null;
  /** 🏪 に止まってクーポンをもらった人数 */
  landed: CountM;
  used: CountM;
}

export interface ShopSummary {
  shopId: ShopId;
  period: PeriodInfo;
  coupons: { issued: CountM; used: CountM; usedOnRevisit: CountM };
  qr: CountM;
  hourly: { from: number; to: number; count: CountM }[];
  sameDay: { spotId: SpotId; people: CountM }[];
  campaigns: CampaignView[];
  unreadVoices: number;
}

export interface DemandView {
  shopId: ShopId;
  radiusM: number;
  threshold: number;
  spots: { spotId: SpotId; people: CountM }[];
  total: CountM;
  /** 合計の「n人以上」。内訳に隠した行があるとき */
  totalAtLeast: boolean;
  canCreate: boolean;
  /** あと何人で作れるか。5人未満のうちは null（人数を当てられないように） */
  remaining: number | null;
  blocking: CampaignView | null;
}

export interface VoiceView {
  id: number;
  text: string;
  day: string;
  age: Age | null;
  masked: boolean;
  dummy: boolean;
  read: boolean;
}
export interface VoicesView { items: VoiceView[]; counts: { all: number; unread: number; read: number } }
