// 文言の辞書: 辞書どうしでキーが重ならない（重なると後の辞書が黙って上書きする）。日英の両方がある。
import { describe, expect, it } from 'vitest';
import { WORD_SETS } from '../../../app/client/src/i18n/index.ts';

describe('文言の辞書', () => {
  it('辞書どうしでキーが重ならない', () => {
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const [set, words] of Object.entries(WORD_SETS)) {
      for (const key of Object.keys(words)) {
        const prev = seen.get(key);
        if (prev) dups.push(`${key}: ${prev} と ${set}`);
        seen.set(key, set);
      }
    }
    expect(dups).toEqual([]);
  });

  it('すべてのキーに日本語と英語がある', () => {
    const empty: string[] = [];
    for (const words of Object.values(WORD_SETS)) {
      for (const [key, pair] of Object.entries(words) as [string, readonly [string, string]][]) {
        if (!pair[0] || !pair[1]) empty.push(key);
      }
    }
    expect(empty).toEqual([]);
  });
});
