// 「出典：地理院タイル」（R-009）。地図・一覧・簡易地図・概要のどれでも出す。
import { ATTRIBUTION_URL } from './geo.ts';

export function Attribution({ inline = false }: { inline?: boolean }) {
  return (
    <div className={`attr${inline ? ' inline' : ''}`} data-testid="gsi-attribution">
      <a href={ATTRIBUTION_URL} target="_blank" rel="noopener noreferrer">出典：地理院タイル</a>
    </div>
  );
}
