// マーカーの見た目（index.html の .mk）。Leaflet と簡易地図で同じ部品を使う（ADR-012）。DOM で組み立てる。
import type { Spot } from '../../../shared/master/spots.ts';
import { iconSvg } from '../ui/Icon.tsx';

export interface MarkerLook {
  on: boolean;
  selected: boolean;
  seasonText: string;
  name: string;
}

export function markerClass(look: MarkerLook): string {
  return `mk${look.on ? '' : ' off'}${look.selected ? ' sel' : ''}`;
}

/** マーカーの中身（ピン＋ラベル）。外側の要素は呼び出し側が用意する */
export function fillMarker(el: HTMLElement, spot: Spot, look: MarkerLook): void {
  el.replaceChildren();
  const pin = document.createElement('span');
  pin.className = 'pin';
  pin.append(iconSvg(spot.icon, look.on ? 24 : 20));
  const lab = document.createElement('span');
  lab.className = 'lab';
  lab.setAttribute('aria-hidden', 'true');
  const sb = document.createElement('span');
  sb.className = 'sb';
  sb.textContent = look.seasonText;
  lab.append(sb);
  if (look.on || look.selected) {
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = look.name;
    lab.append(nm);
  }
  el.append(pin, lab);
}
