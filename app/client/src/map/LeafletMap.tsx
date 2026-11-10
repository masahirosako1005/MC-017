// Leaflet＋地理院の淡色地図（R-008、ADR-012）。既定のズーム・出典の欄は使わず、自前のボタンとプレートを重ねる。
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Spot, SpotId } from '../../../shared/master/spots.ts';
import { useT } from '../i18n/index.ts';
import { Icon } from '../ui/Icon.tsx';
import { CENTER, MAX_ZOOM, MIN_ZOOM, START_ZOOM, TILE_URL, tileUrlFor } from './geo.ts';
import { fillMarker, markerClass, type MarkerLook } from './marker.ts';
import type { TileHealth } from './useTileHealth.ts';

export interface MapSpot { spot: Spot; look: MarkerLook; label: string }

interface Props {
  spots: readonly MapSpot[];
  selected: SpotId | null;
  onSelect: (id: SpotId) => void;
  health: TileHealth;
  here?: { lat: number; lng: number; label: string } | null;
}

export function LeafletMap({ spots, selected, onSelect, health, here }: Props) {
  const { t } = useT();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const { onTileLoad, onTileError, setProbe } = health;
  /** ボタンで目指すズーム。Leaflet はアニメーション中のズームを捨てるので、終わってから残りを当てる */
  const target = useRef<number | null>(null);
  const zooming = useRef(false);

  const zoomBy = (d: number) => {
    const m = map.current;
    if (!m) return;
    target.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (target.current ?? m.getZoom()) + d));
    if (!zooming.current) m.setZoom(target.current);
  };

  useEffect(() => {
    if (!box.current) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const m = L.map(box.current, {
      center: CENTER, zoom: START_ZOOM, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
      zoomControl: false, attributionControl: false, keyboard: true, zoomAnimation: !reduce, fadeAnimation: !reduce,
    });
    m.on('zoomstart', () => { zooming.current = true; });
    m.on('zoomend', () => {
      zooming.current = false;
      if (target.current !== null && target.current !== m.getZoom()) m.setZoom(target.current);
      else target.current = null;
    });
    const tiles = L.tileLayer(TILE_URL, { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, crossOrigin: false });
    tiles.on('tileload', onTileLoad);
    tiles.on('tileerror', onTileError);
    tiles.addTo(m);
    const probe = () => { const c = m.getCenter(); setProbe(tileUrlFor(c.lat, c.lng, m.getZoom())); };
    m.on('moveend', probe);
    probe();
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, [onTileLoad, onTileError, setProbe]);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const ordered = [...spots].sort((a, b) => Number(a.look.on) - Number(b.look.on));
    for (const s of ordered) {
      const el = document.createElement('div');
      el.className = markerClass(s.look);
      fillMarker(el, s.spot, s.look);
      const icon = L.divIcon({ html: el, className: 'mkicon', iconSize: [48, 48], iconAnchor: [24, 24] });
      const mk = L.marker([s.spot.lat, s.spot.lng], { icon, keyboard: true, zIndexOffset: s.look.selected ? 1000 : s.look.on ? 100 : 0 });
      mk.on('click', () => select.current(s.spot.id));
      mk.addTo(g);
      const node = mk.getElement();
      node?.setAttribute('aria-label', s.label);
      node?.setAttribute('data-spot', s.spot.id);
      // Leaflet はポップアップを付けないと Enter で click を出さないので、Enter と Space で選べるようにする（WCAG 2.1.1）
      node?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        select.current(s.spot.id);
      });
    }
    if (here) {
      const el = document.createElement('div');
      el.className = 'here';
      el.textContent = here.label;
      L.marker([here.lat, here.lng], { icon: L.divIcon({ html: el, className: 'hereicon', iconSize: [120, 32], iconAnchor: [60, 16] }), keyboard: false, interactive: false })
        .addTo(g);
    }
  }, [spots, here]);

  useEffect(() => {
    const m = map.current;
    const s = spots.find((x) => x.spot.id === selected);
    if (!m || !s) return;
    // 概要シート（画面の下 1/3）に隠れないよう、アイコンを残りの見える所の中央へ
    const offset = (document.getElementById('phone')?.clientHeight ?? 0) / 6;
    const z = m.getZoom();
    m.panTo(m.unproject(m.project([s.spot.lat, s.spot.lng], z).add([0, offset]), z));
  }, [selected, spots]);

  return (
    <>
      <div ref={box} className="leaflet-box" role="region" aria-label={t('mapLabel')} data-testid="leaflet-map" />
      <div className="mapctl">
        <button type="button" className="ib" aria-label={t('zoomIn')} onClick={() => zoomBy(1)} data-testid="zoom-in">
          <Icon name="plus" size={22} sw={2.5} />
        </button>
        <button type="button" className="ib" aria-label={t('zoomOut')} onClick={() => zoomBy(-1)} data-testid="zoom-out">
          <Icon name="minus" size={22} sw={2.5} />
        </button>
      </div>
    </>
  );
}
