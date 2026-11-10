// 切り替えボタンの組（index.html の .seg）。押されている方を aria-pressed で示す。
export interface SegOption<V> { value: V; label: string; className?: string; testId?: string }

export function Seg<V extends string | boolean>({ label, value, options, onChange }: {
  label: string;
  value: V;
  options: readonly SegOption<V>[];
  onChange: (v: V) => void;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={o.className} aria-pressed={value === o.value ? 'true' : 'false'}
          data-testid={o.testId} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
