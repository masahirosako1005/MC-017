// 効果音（R-022）。Web Audio で作る。効果音「なし」では AudioContext を作らない。音声ファイルは使わない。
import { getSettings } from './settings.ts';

type Kind = 'tick' | 'step' | 'ok' | 'gift' | 'tap' | 'fanfare' | 'perk';
const FREQ: Readonly<Record<Kind, number>> = { tick: 520, step: 660, ok: 880, gift: 990, tap: 440, fanfare: 784, perk: 1047 };
let ctx: AudioContext | null = null;

/** ゴールのファンファーレ: ド・ミ・ソ・ド の4音、全体で約1.2秒（3秒以内） */
const FANFARE = [523, 659, 784, 1047] as const;

/** 特典・割引マスのファンファーレ（派手版）: クラッカーの「パーン」→ 駆け上がり → 大きな和音 → きらきら。約2.4秒（3秒以内） */
const PERK_RUN = [523, 659, 784, 1047, 1319, 1047, 1319, 1568] as const;
const PERK_CHORD = [523, 784, 1047, 1319, 1568] as const;
const PERK_SPARKLE = [2093, 2637, 3136, 2637, 3136, 4186] as const;
const RUN_STEP = 0.1;

function pop(at: number): void {
  try {
    ctx ??= new AudioContext();
    const len = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    g.gain.value = 0.5;
    src.connect(g).connect(ctx.destination);
    src.start(ctx.currentTime + at);
  } catch {
    // 音が出せない環境では鳴らさない
  }
}

export function beep(kind: Kind): void {
  if (!getSettings().sfx) return;
  if (kind === 'perk') {
    pop(0);
    pop(0.16);
    const t0 = 0.3;
    PERK_RUN.forEach((f, i) => {
      tone(f, t0 + i * RUN_STEP, 0.16, 'square', 0.07);
      tone(f / 2, t0 + i * RUN_STEP, 0.16, 'sawtooth', 0.04);
    });
    const tc = t0 + PERK_RUN.length * RUN_STEP + 0.04;
    PERK_CHORD.forEach((f) => tone(f, tc, 1.0, 'sawtooth', 0.05));
    PERK_CHORD.forEach((f) => tone(f, tc, 1.1, 'triangle', 0.09));
    PERK_SPARKLE.forEach((f, i) => tone(f, tc + 0.15 + i * 0.09, 0.2, 'sine', 0.07));
    pop(tc);
    return;
  }
  if (kind === 'fanfare') {
    FANFARE.forEach((f, i) => tone(f, i * 0.18, i === FANFARE.length - 1 ? 0.6 : 0.16));
    return;
  }
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const n = ctx.currentTime;
    const f = FREQ[kind];
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, n);
    if (kind === 'ok' || kind === 'gift') o.frequency.setValueAtTime(f * 1.25, n + 0.08);
    g.gain.setValueAtTime(0.12, n);
    g.gain.exponentialRampToValueAtTime(0.001, n + (kind === 'gift' ? 0.45 : 0.15));
    o.connect(g).connect(ctx.destination);
    o.start(n);
    o.stop(n + 0.5);
  } catch {
    // 音が出せない環境では鳴らさない
  }
}

function tone(freq: number, at: number, len: number, type: OscillatorType = 'triangle', vol = 0.12): void {
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const n = ctx.currentTime + at;
    o.type = type;
    o.frequency.setValueAtTime(freq, n);
    g.gain.setValueAtTime(vol, n);
    g.gain.exponentialRampToValueAtTime(0.001, n + len);
    o.connect(g).connect(ctx.destination);
    o.start(n);
    o.stop(n + len + 0.05);
  } catch {
    // 音が出せない環境では鳴らさない
  }
}

/** 試験用: AudioContext を作ったか */
export function audioCreated(): boolean {
  return ctx !== null;
}
