// API の失敗を画面の文にする（原因と次の行動。エラーの中身は出さない）
import { ApiFailure } from './api.ts';
import type { T } from './i18n/index.ts';

export function errorText(t: T, err: unknown): string {
  if (err instanceof ApiFailure) {
    if (err.status === 0) return t('errNetwork');
    if (err.status === 409) return t('errConflict');
  }
  return t('errServer');
}
