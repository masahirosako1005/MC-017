// みんなのひとこと（R-016・C6、データ設計 §2.4）。すべてダミー。名前・連絡先を含まない。利用者のひとことは入れない。
import { SPOTS, distanceM, spotById, type Pair, type Spot, type SpotId } from './spots.ts';
import type { Age, Companion } from '../schemas.ts';

export interface DummyVoice { age: Age; companion: Companion; text: Pair }

export const DUMMY_VOICES: Readonly<Record<SpotId, readonly DummyVoice[]>> = {
  s1: [
    { age: '20s', companion: 'friends', text: ['夜の灯りがきれいで、また来たくなった。', 'The night lights were beautiful. I want to come again.'] },
    { age: '60s', companion: 'couple', text: ['ベンチが多くて ゆっくり歩けました。', 'Lots of benches, so we could walk slowly.'] },
  ],
  s2: [
    { age: '30s', companion: 'family', text: ['芝生で子どもが走り回れて よかった。', 'The kids could run around on the lawn.'] },
    { age: '40s', companion: 'solo', text: ['桜の季節にもう一度来たい。', 'I want to come back in cherry blossom season.'] },
  ],
  s3: [
    { age: '10s', companion: 'family', text: ['青い光の水そうが 夢みたいだった。', 'The blue-lit tanks were like a dream.'] },
    { age: '30s', companion: 'couple', text: ['夜の展示は 昼と雰囲気がちがう。', 'The night exhibits feel different from the daytime.'] },
  ],
  s4: [
    { age: '20s', companion: 'friends', text: ['屋台が多くて 食べ歩きが楽しい。', 'So many food stalls. Great for snacking.'] },
    { age: '50s', companion: 'family', text: ['盆踊りに 飛び入りで参加できた。', 'We joined the Bon dance on the spot.'] },
  ],
  s5: [
    { age: '60s', companion: 'couple', text: ['もみじの小道は 坂があるので ゆっくりと。', 'The maple path has slopes, so take it slow.'] },
    { age: '30s', companion: 'family', text: ['動物と紅葉を いっしょに楽しめた。', 'We enjoyed both the animals and the autumn leaves.'] },
  ],
  s6: [
    { age: '40s', companion: 'family', text: ['むかしの道具に 子どもが夢中だった。', 'The kids loved the old tools.'] },
    { age: '20s', companion: 'solo', text: ['静かに見られて 雨の日にも よい。', 'Quiet, and good on a rainy day.'] },
  ],
  s7: [
    { age: '10s', companion: 'friends', text: ['プラネタリウムで 冬の星座を覚えた。', 'I learned the winter constellations at the planetarium.'] },
    { age: '50s', companion: 'couple', text: ['ドームが大きくて 見ごたえがある。', 'The dome is huge and well worth it.'] },
  ],
  s8: [
    { age: '30s', companion: 'solo', text: ['ちょうちん教室で 自分だけのお土産ができた。', 'I made my own souvenir at the lantern class.'] },
    { age: '60s', companion: 'family', text: ['店の人が やさしく教えてくれた。', 'The staff taught us kindly.'] },
  ],
  s9: [
    { age: '20s', companion: 'couple', text: ['季節のきしめんが おいしかった。', 'The seasonal kishimen was delicious.'] },
    { age: '40s', companion: 'solo', text: ['ひとりでも入りやすい店。', 'Easy to drop in alone.'] },
  ],
  s10: [
    { age: '20s', companion: 'friends', text: ['ちょうちんの道を歩くだけで楽しい。', 'Just walking the lantern alley is fun.'] },
    { age: '30s', companion: 'couple', text: ['冬の夜に あたたかい飲みものが うれしい。', 'A warm drink on a winter night is nice.'] },
  ],
  s11: [
    { age: '50s', companion: 'friends', text: ['ひとくちサイズで いろいろ食べられた。', 'Bite-size, so we could try lots.'] },
    { age: '10s', companion: 'family', text: ['みそかつが 思ったより あまかった。', 'The misokatsu was sweeter than I expected.'] },
  ],
};

export function dummyVoices(spotId: SpotId): readonly DummyVoice[] {
  return DUMMY_VOICES[spotId];
}

/** 近くのお店（R-016・C3）。直線距離の近い順に最大3件、10m 単位に丸める */
export function nearbyShops(spotId: SpotId, limit = 3): { spot: Spot; meters: number }[] {
  const base = spotById(spotId);
  return SPOTS.filter((s) => s.kind === 'shop' && s.id !== spotId)
    .map((s) => ({ spot: s, meters: Math.round(distanceM(base, s) / 10) * 10 }))
    .sort((a, b) => a.meters - b.meters || a.spot.id.localeCompare(b.spot.id))
    .slice(0, limit);
}
