// おすすめコース（R-004、データ設計 §2.4）。時間・距離・休憩所の数は【仮定】の見本値。
import type { IconName, Pair, SpotId } from './spots.ts';

export interface Course {
  id: string;
  icon: IconName;
  name: Pair;
  hours: number;
  km: number;
  stepFree: boolean;
  rest: number;
  spots: readonly SpotId[];
}

export const COURSES: readonly Course[] = [
  { id: 'castle-park', icon: 'castle', name: ['お城と公園さんぽ', 'Castle & park walk'], hours: 2, km: 2.1, stepFree: true, rest: 3, spots: ['s1', 's7', 's2'] },
  { id: 'port-sea', icon: 'fish', name: ['港で海の生きもの', 'Sea life by the port'], hours: 3, km: 1.2, stepFree: true, rest: 5, spots: ['s3', 's4'] },
  { id: 'higashiyama-osu', icon: 'paw', name: ['東山と大須の食べ歩き', 'Higashiyama & Osu food walk'], hours: 4, km: 3.5, stepFree: false, rest: 4, spots: ['s5', 's10', 's9'] },
];

/** 段差少なめを選んだ人には段差のあるコースを出さない（AC-005） */
export function coursesFor(stepLess: boolean): Course[] {
  return COURSES.filter((c) => !stepLess || c.stepFree);
}
