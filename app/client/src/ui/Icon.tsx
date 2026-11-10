// アイコン（index.html の IC をそのまま移植）。装飾なので aria-hidden。
const C = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const IC = {
  castle: 'M4 21h16M6 21v-8h12v8M8 13V9h8v4M10 9V6h4v3M9 6l3-3 3 3M11 21v-3h2v3',
  paw: C(7, 10, 1.8) + C(10.5, 6.5, 1.8) + C(14.5, 6.5, 1.8) + C(18, 10, 1.8) + 'M12 12c-3 0-6 4-6 6.5 0 1.5 1.5 2 3 1.5 1.5-.5 4.5-.5 6 0 1.5.5 3 0 3-1.5 0-2.5-3-6.5-6-6.5z',
  fish: 'M3 12c3-5 9-6 13-2l4-3v10l-4-3c-4 4-10 3-13-2z' + C(8, 11, 0.6),
  star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4l-5.3 3 1.2-6-4.5-4.1 6-.7z',
  tree: 'M12 21v-6M12 15c-4 0-7-2.5-7-6a7 7 0 0 1 14 0c0 3.5-3 6-7 6zM9 21h6',
  museum: 'M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  bowl: 'M3 11h18a9 9 0 0 1-18 0zM8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4M8 20h8',
  lantern: 'M9 3h6M12 3v2M7 9.5a5 4.5 0 0 1 10 0v5a5 4.5 0 0 1-10 0zM7 12h10M9 21h6M12 19v2',
  flag: 'M5 21V4M5 4h12l-2.5 4L17 12H5',
  station: 'M3 10l9-6 9 6M5 10v10h14V10M9 20v-5h6v5M3 20h18',
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z' + C(12, 10, 2.5),
  dice: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' + C(9, 9, 0.9) + C(15, 15, 0.9) + C(12, 12, 0.9),
  chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM15 7v2M15 11v2M15 15v2',
  gear: C(12, 12, 3) + 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  speaker: 'M4 9h4l5-4v14l-5-4H4zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11',
  stop: 'M7 7h10v10H7z',
  chev: 'M9 5l7 7-7 7',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0',
  pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  plane: 'M3 11l18-8-7 18-3-7z M11 14l10-11',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2',
  check: 'M5 12l5 5 9-10',
  info: C(12, 12, 9) + 'M12 11v5M12 8h.01',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M12 20h.01M19 13a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5.1',
  crystal: C(12, 10, 6) + 'M7 20h10M9 16.5l-1 3.5M15 16.5l1 3.5',
  spring: C(12, 7, 2.6) + C(16.8, 10.5, 2.6) + C(15, 16, 2.6) + C(9, 16, 2.6) + C(7.2, 10.5, 2.6),
  summer: C(12, 12, 4) + 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  autumn: 'M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l8-8',
  winter: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5',
  percent: 'M19 5L5 19' + C(7.5, 7.5, 2) + C(16.5, 16.5, 2),
  again: 'M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5',
  all: C(12, 12, 8) + 'M12 7v5l3 2',
} as const;

export type IconName = keyof typeof IC;

export function Icon({ name, size = 24, sw = 2 }: { name: IconName; size?: number; sw?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={IC[name]} />
    </svg>
  );
}

/** アイコンの path を文字列で返す（Leaflet の divIcon 用。DOM で組み立てる） */
export function iconSvg(name: IconName, size: number): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: String(size), height: String(size), fill: 'none', stroke: 'currentColor',
    'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) {
    svg.setAttribute(k, v);
  }
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', IC[name]);
  svg.append(p);
  return svg;
}
