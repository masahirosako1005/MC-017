// ブラウザの声の選び方（R-041、ADR-011）。端末内の声だけを使い、名前に Online を含む声は使わない。
export interface VoiceLike {
  name: string;
  lang: string;
  localService: boolean;
}

export function pickVoice<T extends VoiceLike>(voices: readonly T[], lang: 'ja' | 'en'): T | null {
  const usable = voices.filter((v) => v.localService && !/online/i.test(v.name) && v.lang.toLowerCase().startsWith(lang));
  if (usable.length === 0) return null;
  if (lang === 'ja') {
    const nanami = usable.find((v) => /nanami/i.test(v.name));
    if (nanami) return nanami;
  }
  return usable[0] ?? null;
}
