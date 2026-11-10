// ログは1行1件。改行や制御文字はエスケープし、本文・個人に見える値は渡さない（SEC-ERR-09）。
type Level = 'info' | 'warn' | 'error';

function clean(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v) ?? String(v);
  return s.replace(/[\u0000-\u001f\u007f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).slice(0, 500);
}

let quiet = false;
export function setQuietLog(q: boolean): void {
  quiet = q;
}

export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (quiet && level === 'info') return;
  const parts = Object.entries(fields).map(([k, v]) => `${k}=${clean(v)}`);
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${clean(msg)}${parts.length ? ' ' + parts.join(' ') : ''}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}
