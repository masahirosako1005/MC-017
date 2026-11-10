// ダミー ID（R-001、ADR-005）。端末内で作り localStorage に置く。名前・連絡先は扱わない。
const KEY = 'mc017.guestId';
const PATTERN = /^guest-[a-z0-9]{6}$/;
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function newGuestId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += CHARS[b % CHARS.length] ?? 'a';
  return `guest-${s}`;
}

export function guestId(): string {
  const saved = readSaved();
  if (saved && PATTERN.test(saved)) return saved;
  const id = newGuestId();
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // localStorage が使えない環境では、この表示の間だけの ID になる
  }
  return id;
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
