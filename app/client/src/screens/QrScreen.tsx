// SC-10 QR スタンプ（見本。カメラは使わない。R-013）
import { useState } from 'react';
import { spotById } from '../../../shared/master/spots.ts';
import type { TriggerResult } from '../../../shared/schemas.ts';
import { api } from '../api.ts';
import { useApp } from '../app-context.ts';
import { useT } from '../i18n/index.ts';
import { beep } from '../sfx.ts';
import { useOnce } from '../use-once.ts';
import { markChecked } from './ProphecyScreen.tsx';
import { noteGain } from '../gain.ts';
import { PlusBadge } from '../ui/Buddy.tsx';
import { Frame } from '../ui/Frame.tsx';
import { Icon } from '../ui/Icon.tsx';

export function QrScreen() {
  const { spotId, go, refresh, fail } = useApp();
  const { t, L } = useT();
  const s = spotById(spotId);
  const { run, pending } = useOnce();
  const [result, setResult] = useState<TriggerResult | null>(null);

  const scan = async () => {
    try {
      const r = await run((requestId) => api<TriggerResult>('POST', `/spots/${spotId}/qr`, { requestId }));
      if (!r) return;
      beep('ok');
      await refresh();
      if (r.prophecyCheck) {
        markChecked(r.prophecyCheck.prophecyId);
        go('prophecy', undefined, true);
        return;
      }
      setResult(r);
    } catch (err) {
      fail(err, () => void scan());
    }
  };

  if (result) {
    return (
      <Frame title={t('qrTitle')} action={
        <button type="button" className="btn accent" data-testid="to-play" onClick={() => { if (result.granted) noteGain('gainQr'); go('play'); }}><Icon name="dice" />{t('toPlay')}</button>
      }>
        <div className="got" role="status" data-testid="qr-result" data-granted={result.granted ? '1' : '0'}>
          <div className="stamp"><Icon name={s.icon} size={70} sw={1.8} /></div>
          <h2>{t('qrOk')}</h2>
          <p className="lead">{L(s.name)}</p>
          {result.granted
            ? <div className="dicegain"><Icon name="dice" size={22} />{t('qrOkDice')}</div>
            : <p className="muted">{t('qrAgain')}</p>}
        </div>
      </Frame>
    );
  }

  return (
    <Frame title={t('qrTitle')} action={
      <button type="button" className="btn primary" data-testid="scan" disabled={pending} onClick={() => void scan()}>
        <Icon name="qr" />{t('qrScan')}<PlusBadge label={t('plusOne')} />
      </button>
    }>
      <p className="lead center gap8">{t('qrLead')}</p>
      <div className="scan" aria-hidden="true">
        <FakeQr />
        <i className="cn c1" /><i className="cn c2" /><i className="cn c3" /><i className="cn c4" /><i className="ln" />
      </div>
      <div className="note"><Icon name="info" size={20} /><span>{t('qrMock')}</span></div>
    </Frame>
  );
}

const QR_CELLS: readonly (readonly [number, number])[] = (() => {
  const n = 21;
  const cells: [number, number][] = [];
  let seed = 11;
  const finder = (x: number, y: number) => [[0, 0], [14, 0], [0, 14]].find(([fx = 0, fy = 0]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      seed = (seed * 9301 + 49297) % 233280;
      const f = finder(x, y);
      let on: boolean;
      if (f) {
        const dx = x - (f[0] ?? 0);
        const dy = y - (f[1] ?? 0);
        on = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      } else {
        on = seed / 233280 > 0.52;
      }
      if (on) cells.push([x, y]);
    }
  }
  return cells;
})();

function FakeQr() {
  return (
    <svg width={168} height={168} viewBox="-7 -7 161 161" focusable="false">
      <rect x={-7} y={-7} width={161} height={161} rx={8} fill="#fff" />
      {QR_CELLS.map(([x, y]) => <rect key={`${x}-${y}`} x={x * 7} y={y * 7} width={7} height={7} fill="#25302E" />)}
    </svg>
  );
}
