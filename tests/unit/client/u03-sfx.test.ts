// U-03: T-029 効果音なしでは Web Audio を作らない（クライアントのコードなので app/client/tsconfig.json で型を検査する）
import { describe, expect, it } from 'vitest';
import { setSetting } from '../../../app/client/src/settings.ts';
import { audioCreated, beep } from '../../../app/client/src/sfx.ts';

describe('T-029 効果音', () => {
  it('効果音なしでは Web Audio を作らない（ありなら作る）', () => {
    let made = 0;
    const g = globalThis as unknown as Record<string, unknown>;
    g.AudioContext = class {
      currentTime = 0;
      destination = {};
      constructor() { made += 1; }
      createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect: (x: unknown) => x, start() {}, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x }; }
    };
    try {
      setSetting('sfx', false);
      for (const k of ['tick', 'step', 'ok', 'gift', 'tap', 'fanfare'] as const) beep(k);
      expect(made).toBe(0);
      expect(audioCreated()).toBe(false);
      setSetting('sfx', true);
      beep('fanfare');
      expect(made).toBe(1);
      expect(audioCreated()).toBe(true);
    } finally {
      delete g.AudioContext;
    }
  });
});
