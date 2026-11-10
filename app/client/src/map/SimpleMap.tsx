// 簡易地図（R-010、ADR-012）。タイルなし。スポットの緯度経度を枠に直線で置き、Leaflet と同じマーカー部品を使う。
import { useEffect, useRef } from 'react';
import type { SpotId } from '../../../shared/master/spots.ts';
import { useT } from '../i18n/index.ts';
import { Icon } from '../ui/Icon.tsx';
import { BOUNDS } from './geo.ts';
import type { MapSpot } from './LeafletMap.tsx';
import { fillMarker, markerClass } from './marker.ts';

function place(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100,
    y: ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100,
  };
}

function SimpleMarker({ s, onSelect }: { s: MapSpot; onSelect: (id: SpotId) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (ref.current) fillMarker(ref.current, s.spot, s.look);
  }, [s]);
  const p = place(s.spot.lat, s.spot.lng);
  return (
    <button ref={ref} type="button" className={markerClass(s.look)} aria-label={s.label} data-spot={s.spot.id}
      style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => onSelect(s.spot.id)} />
  );
}

export function SimpleMap({ spots, onSelect, here }: { spots: readonly MapSpot[]; onSelect: (id: SpotId) => void; here?: { lat: number; lng: number; label: string } | null }) {
  const { t } = useT();
  const ordered = [...spots].sort((a, b) => Number(a.look.on) - Number(b.look.on));
  const hp = here ? place(here.lat, here.lng) : null;
  return (
    <div className="simplemap" role="region" aria-label={t('simpleMapLabel')} data-testid="simple-map">
      <svg className="simplebg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="0" width="100" height="100" fill="#F4F0E6" />
        <path d="M0 92 C20 88 40 96 60 90 S90 88 100 91 L100 100 L0 100Z" fill="#D6E9F2" />
      </svg>
      <div className="offbadge" role="status" aria-live="polite" data-testid="offline-badge">
        <Icon name="wifiOff" size={18} />オフライン表示中
      </div>
      <p className="offhint">{t('offlineHint')}</p>
      <div className="simplearea">
        {hp && here && <div className="here" style={{ left: `${hp.x}%`, top: `${hp.y}%` }}>{here.label}</div>}
        {ordered.map((s) => <SimpleMarker key={s.spot.id} s={s} onSelect={onSelect} />)}
      </div>
    </div>
  );
}
