// 二重送信を防ぐ（R-048・ADR-006）。成功するまで同じ requestId を使うので、失敗後の「もう一度」も1回分になる。
import { useCallback, useRef, useState } from 'react';
import { requestId } from './api.ts';

export function useOnce(): { run: <R>(fn: (id: string) => Promise<R>) => Promise<R | null>; pending: boolean } {
  const busy = useRef(false);
  const id = useRef(requestId());
  const [pending, setPending] = useState(false);
  const run = useCallback(async <R,>(fn: (id: string) => Promise<R>): Promise<R | null> => {
    if (busy.current) return null;
    busy.current = true;
    setPending(true);
    try {
      const r = await fn(id.current);
      id.current = requestId();
      return r;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);
  return { run, pending };
}
