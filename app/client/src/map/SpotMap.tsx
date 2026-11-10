// 地図の入れ物（SC-03）。通常は Leaflet、オフラインでは簡易地図。出典のプレートはどちらでも出す。
import type { SpotId } from '../../../shared/master/spots.ts';
import { Attribution } from './Attribution.tsx';
import { LeafletMap, type MapSpot } from './LeafletMap.tsx';
import { SimpleMap } from './SimpleMap.tsx';
import { useTileHealth } from './useTileHealth.ts';

interface Props {
  spots: readonly MapSpot[];
  selected: SpotId | null;
  onSelect: (id: SpotId) => void;
  here?: { lat: number; lng: number; label: string } | null;
}

export function SpotMap({ spots, selected, onSelect, here = null }: Props) {
  const health = useTileHealth();
  return (
    <div className={`mapwrap${health.offline ? ' offline' : ''}`} data-offline={health.offline ? '1' : '0'}>
      {health.offline
        ? <SimpleMap spots={spots} onSelect={onSelect} here={here} />
        : <LeafletMap spots={spots} selected={selected} onSelect={onSelect} health={health} here={here} />}
      <Attribution />
    </div>
  );
}
