// ゴールの紙吹雪（R-020）。落ちるだけで点滅しない（WCAG 2.3.1）。動きを減らす設定では少なく短い。
const COLORS = ['#F4B43A', '#0E7C74', '#D2402A', '#5B8DEF', '#FFFFFF'] as const;

export function Confetti({ reduced }: { reduced: boolean }) {
  const n = reduced ? 8 : 28;
  return (
    <div className={`confetti${reduced ? ' short' : ''}`} aria-hidden="true" data-testid="confetti">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{
          left: `${(i * 37) % 100}%`,
          background: COLORS[i % COLORS.length],
          animationDelay: `${(i % 7) * 0.08}s`,
          transform: `rotate(${(i * 53) % 360}deg)`,
        }} />
      ))}
    </div>
  );
}
