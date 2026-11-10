// すごろくの「増えたきっかけ」の帯（SC-05 #2）。増やした画面が印をつけ、すごろくが開いたときに1回だけ出す。
export type GainKey = 'gainQr' | 'gainNote' | 'gainInvite' | 'gainProphecy' | 'gainDay2' | 'gainRevisit' | 'gainDemo';

let pending: GainKey | null = null;

export function noteGain(key: GainKey): void {
  pending = key;
}

export function takeGain(): GainKey | null {
  const k = pending;
  pending = null;
  return k;
}
