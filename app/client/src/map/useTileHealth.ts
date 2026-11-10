// オフラインの判定（R-010、ADR-012）。navigator.onLine とタイルの連続エラー。簡易地図の間は15秒ごとにタイル1枚だけ読み直す。
import { useCallback, useEffect, useRef, useState } from 'react';
import { ERROR_LIMIT, RECHECK_MS } from './geo.ts';

export interface TileHealth {
  offline: boolean;
  onTileLoad: () => void;
  onTileError: () => void;
  /** 再確認で読むタイルの URL を地図側から渡す */
  setProbe: (url: string) => void;
}

export function useTileHealth(): TileHealth {
  const [netOff, setNetOff] = useState(() => !navigator.onLine);
  const [tilesOff, setTilesOff] = useState(false);
  const errors = useRef(0);
  const probe = useRef<string | null>(null);

  useEffect(() => {
    const on = () => { setNetOff(false); errors.current = 0; setTilesOff(false); };
    const off = () => setNetOff(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const offline = netOff || tilesOff;

  useEffect(() => {
    if (!offline) return undefined;
    const timer = setInterval(() => {
      if (!navigator.onLine || !probe.current) return;
      const img = new Image();
      img.onload = () => { errors.current = 0; setNetOff(false); setTilesOff(false); };
      img.src = `${probe.current}${probe.current.includes('?') ? '&' : '?'}t=${Date.now()}`;
    }, RECHECK_MS);
    return () => clearInterval(timer);
  }, [offline]);

  const onTileLoad = useCallback(() => { errors.current = 0; }, []);
  const onTileError = useCallback(() => {
    errors.current += 1;
    if (errors.current >= ERROR_LIMIT) setTilesOff(true);
  }, []);
  const setProbe = useCallback((url: string) => { probe.current = url; }, []);

  return { offline, onTileLoad, onTileError, setProbe };
}
