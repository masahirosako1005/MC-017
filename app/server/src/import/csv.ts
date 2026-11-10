// 依存なしの CSV 読み取り（ADR-009）。BOM・CRLF/LF・引用符と "" に対応し、不正な UTF-8 は止める。

/** バイト列を UTF-8 として読む。先頭の BOM は外す。不正なバイトがあれば例外 */
export function decodeUtf8(bytes: Uint8Array): string {
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** CSV の文字列を行ごとの配列にする。空行は飛ばす。閉じていない引用符は例外 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const pushRow = () => {
    row.push(field);
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
    field = '';
  };
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"' && field === '') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r' || c === '\n') {
      pushRow();
      if (c === '\r' && text[i + 1] === '\n') i += 1;
    } else {
      field += c;
    }
    i += 1;
  }
  if (quoted) throw new Error('unterminated quote');
  if (field !== '' || row.length > 0) pushRow();
  return rows;
}

/** 見出しの列名から、使う列の位置を引く。足りない列があれば null */
export function columnIndex<K extends string>(header: readonly string[], wanted: readonly K[]): Record<K, number> | null {
  const out = {} as Record<K, number>;
  for (const w of wanted) {
    const idx = header.indexOf(w);
    if (idx < 0) return null;
    out[w] = idx;
  }
  return out;
}
