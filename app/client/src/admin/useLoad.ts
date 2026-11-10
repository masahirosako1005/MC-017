// 読み込み（読み込み中・失敗・成功）を持つフック。条件（key）が変わったら読み直し、古い応答は捨てる。
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from './api.ts';

export type Load<T> = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ok'; data: T };

export interface LoadHandle<T> {
  load: Load<T>;
  /** 読み込み中の表示に戻して読み直す（「もう一度」） */
  retry: () => void;
  /** いまの表示を残したまま読み直す（操作の後） */
  refresh: () => void;
}

export function useLoad<T>(fetcher: () => Promise<T>, key: string): LoadHandle<T> {
  const [load, setLoad] = useState<Load<T>>({ kind: 'loading' });
  const [tick, setTick] = useState(0);
  const quietRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let alive = true;
    if (!quietRef.current) setLoad({ kind: 'loading' });
    quietRef.current = false;
    fetcherRef.current().then(
      (data) => {
        if (alive) setLoad({ kind: 'ok', data });
      },
      (e: unknown) => {
        if (alive) setLoad({ kind: 'error', message: errorText(e, 'load') });
      },
    );
    return () => {
      alive = false;
    };
  }, [key, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  const refresh = useCallback(() => {
    quietRef.current = true;
    setTick((t) => t + 1);
  }, []);
  return { load, retry, refresh };
}
