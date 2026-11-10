// API の入力スキーマと応答の型（API設計 §3）。未知キーは z.strictObject で拒否（ADR-004）。
import { z } from 'zod';
import { SPOT_IDS, type Pair, type Season, type SpotId } from './master/spots.ts';
import { AVATAR_IDS, type AvatarId } from './master/avatars.ts';
import type { TemplateId } from './master/coupons.ts';

export const AGES = ['10s', '20s', '30s', '40s', '50s', '60s'] as const;
export type Age = (typeof AGES)[number];
export const COMPANIONS = ['solo', 'family', 'couple', 'friends'] as const;
export type Companion = (typeof COMPANIONS)[number];
export const TRIGGERS = ['qr', 'note', 'invite'] as const;
export type Trigger = (typeof TRIGGERS)[number];
export const ANSWERS = ['liked', 'normal', 'later'] as const;
export type Answer = (typeof ANSWERS)[number];

export const guestIdSchema = z.string().regex(/^guest-[a-z0-9]{6}$/);
export const spotIdSchema = z.enum(SPOT_IDS);
export const avatarIdSchema = z.enum(AVATAR_IDS);
export const requestIdSchema = z.uuid();

/** 文字数はコードポイントで数える（SQLite の length() と同じ数え方） */
export function charCount(s: string): number {
  return [...s].length;
}

const textSchema = (max: number) =>
  z
    .string()
    .max(max * 2)
    .refine((s) => charCount(s) <= max, { message: 'too long' })
    .refine((s) => s.trim().length >= 1, { message: 'empty' });

export const emptyBodySchema = z.strictObject({});
export const requestBodySchema = z.strictObject({ requestId: requestIdSchema });
export const noteBodySchema = z.strictObject({ requestId: requestIdSchema, text: textSchema(100) });

export const profileBodySchema = z
  .strictObject({
    age: z.enum(AGES).nullable().optional(),
    companion: z.enum(COMPANIONS).nullable().optional(),
    stepLess: z.boolean().optional(),
    avatar: avatarIdSchema.optional(),
  })
  .refine((b) => Object.keys(b).length >= 1, { message: 'no fields' });
export type ProfileBody = z.infer<typeof profileBodySchema>;

export const ttsBodySchema = z.strictObject({ avatarId: avatarIdSchema, text: textSchema(100) });
export type TtsBody = z.infer<typeof ttsBodySchema>;

export const answerBodySchema = z.strictObject({ requestId: requestIdSchema, answer: z.enum(ANSWERS) });

export const demoClockBodySchema = z.strictObject({
  offsetDays: z.int().min(0).max(3650),
  hour: z.int().min(0).max(23).nullable(),
});
export const demoLocationBodySchema = z.strictObject({ spotId: spotIdSchema.nullable() });
export const demoRollsBodySchema = z.strictObject({ requestId: requestIdSchema, amount: z.int().min(1).max(10) });

export const spotParamsSchema = z.strictObject({ spotId: spotIdSchema });
export const idParamsSchema = (key: string) =>
  z.strictObject({ [key]: z.string().regex(/^[1-9][0-9]{0,8}$/).transform(Number) });
export const rumorQuerySchema = z.strictObject({ spot: spotIdSchema.optional() });
export const planBodySchema = z.strictObject({ requestId: requestIdSchema, spotId: spotIdSchema });
export const noQuerySchema = z.strictObject({});

// ---- 応答 ----
export type VisitKind = 'first' | 'day2' | 'revisit';

/** 盤の上の 🏪 マス（店のキャンペーン、U-11） */
export interface BoardExtra { square: number; campaignId: number; shopId: SpotId; label: Pair }

export interface MeState {
  id: string;
  today: string;
  hour: number;
  visitKind: VisitKind;
  bonus: { source: 'day2' | 'revisit'; amount: number } | null;
  profile: { age: Age | null; companion: Companion | null; stepLess: boolean; avatar: AvatarId };
  board: { no: number; pos: number; size: number; extras: BoardExtra[] };
  rollsLeft: number;
  stamps: number;
  newCoupons: number;
  doneToday: Partial<Record<SpotId, Trigger[]>>;
  demo: { offsetDays: number; hour: number | null; location: SpotId | null } | null;
}

export interface PlanView { id: number; spotId: SpotId; createdDay: string }
export interface PlansState { plans: PlanView[]; max: number }

export interface TriggerResult {
  granted: boolean;
  rollsLeft: number;
  prophecyCheck: { prophecyId: number } | null;
}

export type CouponStatus = 'usable' | 'later' | 'used' | 'expired';
export interface Coupon {
  id: number;
  templateId: TemplateId;
  /** キャンペーンの券の名前（サーバーが作る）。それ以外は null */
  label: Pair | null;
  shopId: SpotId;
  season: Season | null;
  obtainedDay: string;
  usableFrom: string;
  expires: string;
  status: CouponStatus;
  isNew: boolean;
}

export type Landed =
  | { kind: 'gift'; coupon: Coupon }
  | { kind: 'shop'; coupon: Coupon }
  | { kind: 'spot'; spotId: SpotId }
  | { kind: 'season'; spotId: SpotId }
  | { kind: 'again' }
  | { kind: 'normal' }
  | { kind: 'goal'; coupon: Coupon; nextBoard: number };

export interface RollResult {
  face: number;
  boardNo: number;
  from: number;
  to: number;
  rollsLeft: number;
  landed: Landed;
  near: { kind: 'gift' | 'goal'; steps: number } | null;
}

export interface Rank { spotId: SpotId; people: number }
export interface Rumors {
  yesterday: Rank[];
  month: Rank[];
  sameAge: Rank[] | null;
  sameCompanion: Rank[] | null;
  quiet: { spotId: SpotId; hours: { hour: number; count: number; quiet: boolean }[] };
}

export type ReasonCode = 'tag' | 'similar' | 'season' | 'stepfree';
export interface Reason { code: ReasonCode; tag?: string; strength: 'strong' | 'mid' | 'weak' }
export type TimeBand = 'morning' | 'noon' | 'evening' | 'night';
export interface Prophecy {
  id: number;
  spotId: SpotId;
  season: Season;
  timeBand: TimeBand;
  reasons: Reason[];
  status: 'open' | 'visited';
  answer: Answer | null;
  createdDay: string;
}
export interface ProphecyState {
  current: Prophecy | null;
  canProphesy: boolean;
  level: number;
  checks: number;
  liked: number;
  normal: number;
  history: { id: number; spotId: SpotId; season: Season; answer: Answer | null; status: 'open' | 'visited' }[];
  others: { spotId: SpotId; reason: Reason | null }[];
}

export interface ApiError { error: { code: string; message: string } }
