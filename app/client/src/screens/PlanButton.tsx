// 「次に行く予定に入れる」（U-10）。スポット詳細に置く。1人3つまで。着いたら（QR）自動で外れる。
import { useEffect, useState } from 'react';
import type { SpotId } from '../../../shared/master/spots.ts';
import type { PlansState } from '../../../shared/schemas.ts';
import { api, ApiFailure, requestId } from '../api.ts';
import { useApp } from '../app-context.ts';
import { useT } from '../i18n/index.ts';
import { Icon } from '../ui/Icon.tsx';

export function PlanButton({ spotId }: { spotId: SpotId }) {
  const { toast, fail } = useApp();
  const { t } = useT();
  const [state, setState] = useState<PlansState | null>(null);

  useEffect(() => {
    let alive = true;
    setState(null);
    api<PlansState>('GET', '/plans').then((s) => { if (alive) setState(s); }).catch(() => undefined);
    return () => { alive = false; };
  }, [spotId]);

  if (!state) return null;
  const mine = state.plans.find((p) => p.spotId === spotId);

  const add = async () => {
    try {
      setState(await api<PlansState>('POST', '/plans', { requestId: requestId(), spotId }));
      toast(t('planDoneToast'));
    } catch (err) {
      if (err instanceof ApiFailure && err.status === 409) toast(t('planFull', { max: state.max }));
      else fail(err, () => void add());
    }
  };
  const remove = async (id: number) => {
    try {
      setState(await api<PlansState>('POST', `/plans/${id}/cancel`, {}));
      toast(t('planRemovedToast'));
    } catch (err) {
      fail(err, () => void remove(id));
    }
  };

  return (
    <div className="card plan" data-testid="plan-box" data-planned={mine ? '1' : '0'}>
      {mine ? (
        <>
          <span className="chip gold" data-testid="plan-in"><Icon name="check" size={14} sw={3} />{t('planIn', { n: state.plans.length, max: state.max })}</span>
          <button type="button" className="btn ghost sm" data-testid="plan-remove" onClick={() => void remove(mine.id)}>{t('planRemove')}</button>
        </>
      ) : (
        <button type="button" className="btn ghost" data-testid="plan-add" onClick={() => void add()}><Icon name="pin" />{t('planAdd')}</button>
      )}
      <p className="muted small">{t('planHint')}</p>
    </div>
  );
}
