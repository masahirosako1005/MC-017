// 大きなクラッカー（プレゼントマスの「おめでとう」の絵）。自前SVG（パーティークラッカーの絵文字風）。飾りなので読み上げない。
export function Cracker({ size = 210 }: { size?: number }) {
  return (
    <svg className="cracker" width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      {/* 紙テープ（平たいリボン） */}
      <path d="M22 26 C44 34 62 56 74 76 C60 76 52 70 46 62 C40 48 30 38 14 34 Z" fill="#35C45A" />
      <path d="M74 76 C66 66 70 54 84 52 C80 60 82 68 90 72 C84 78 78 80 74 76 Z" fill="#1E9E45" />
      <path d="M118 48 C130 28 150 22 168 30 C158 34 150 42 146 54 C140 70 128 78 112 78 C122 70 124 60 118 48 Z" fill="#F0589A" />
      <path d="M12 98 C30 90 52 90 66 98 C78 104 92 104 104 96 C100 108 86 114 70 110 C54 104 36 104 18 110 Z" fill="#8E5BEA" />
      {/* くるくるテープ */}
      <path d="M116 48 C108 42 120 36 124 44 C128 52 116 58 112 50 C108 42 122 38 126 46" fill="none" stroke="#E8454B" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M154 56 C146 52 156 44 162 50 C168 58 156 64 150 56 C146 50 160 46 166 54" fill="none" stroke="#E8454B" strokeWidth="3.5" strokeLinecap="round" />
      {/* 紙ふぶき */}
      <rect x="8" y="64" width="22" height="8" rx="2" fill="#4AA3F0" transform="rotate(35 19 68)" />
      <rect x="120" y="14" width="7" height="18" rx="2" fill="#F0674B" />
      <rect x="82" y="12" width="9" height="14" rx="2" fill="#F5D33A" transform="rotate(20 86 19)" />
      <rect x="168" y="62" width="9" height="9" rx="2" fill="#35C45A" transform="rotate(30 172 66)" />
      <rect x="40" y="108" width="12" height="6" rx="2" fill="#F5D33A" transform="rotate(-15 46 111)" />
      <rect x="152" y="96" width="8" height="8" rx="2" fill="#4AA3F0" />
      <rect x="62" y="30" width="8" height="8" rx="2" fill="#F0589A" transform="rotate(40 66 34)" />
      <rect x="186" y="34" width="8" height="12" rx="2" fill="#8E5BEA" transform="rotate(-25 190 40)" />
      <circle cx="26" cy="46" r="4.5" fill="#F0674B" />
      <circle cx="100" cy="36" r="4" fill="#F0589A" />
      <circle cx="136" cy="66" r="3.5" fill="#F5D33A" />
      <circle cx="58" cy="136" r="4" fill="#F0589A" />
      <circle cx="18" cy="128" r="3.5" fill="#35C45A" />
      <circle cx="176" cy="12" r="4" fill="#4AA3F0" />
      {/* 本体の円すい（口は左上、先は右下） */}
      <path d="M98 129 L188 182 L146 87 Z" fill="#F07C1A" />
      <path d="M116 139.6 L154.4 106 L162 123.1 L132.2 149.1 Z" fill="#FFC631" />
      <path d="M144.8 156.6 L167.8 136.4 L174.6 151.6 L159.2 165 Z" fill="#FFC631" />
      {/* 口 */}
      <ellipse cx="122" cy="108" rx="32" ry="12" transform="rotate(-42 122 108)" fill="#D6490E" />
      <ellipse cx="122" cy="108" rx="26" ry="8.5" transform="rotate(-42 122 108)" fill="#7A2A08" />
      {/* 先のひも */}
      <path d="M188 182 C196 188 198 196 190 198 C184 198 186 190 194 192" fill="none" stroke="#E8454B" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
