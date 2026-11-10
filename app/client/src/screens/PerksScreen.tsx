// SC-07 特典（R-024〜R-026、index.html の perks）。使う前に確認を1回はさむ。利用済みは戻せない。
import { useCallback, useEffect, useRef, useState } from 'react';
import { couponLabel, couponShop } from '../../../shared/master/coupons.ts';
import type { Coupon, CouponStatus } from '../../../shared/schemas.ts';
import { api } from '../api.ts';
import { useApp } from '../app-context.ts';
import { errorText } from '../error-text.ts';
import { useT, type T } from '../i18n/index.ts';
import { beep } from '../sfx.ts';
import { useOnce } from '../use-once.ts';
import { Frame } from '../ui/Frame.tsx';
import { Icon } from '../ui/Icon.tsx';

interface Perks { stamps: number; coupons: Coupon[] }

/** 並び: 新しいもの → 使える → 次に来た日から → 利用済み → 期限切れ（SC-07 #4） */
const ORDER: Readonly<Record<CouponStatus, number>> = { usable: 0, later: 1, used: 2, expired: 3 };
export function sortCoupons(list: readonly Coupon[]): Coupon[] {
  return [...list].sort((a, b) => Number(b.isNew) - Number(a.isNew) || ORDER[a.status] - ORDER[b.status] || b.id - a.id);
}

export function ymd(t: T, day: string): string {
  const [y, m, d] = day.split('-');
  return t('dateYmd', { y: y ?? '', m: Number(m), d: Number(d) });
}

const CHIP: Readonly<Record<CouponStatus, string>> = { usable: 'chip', later: 'chip gold', used: 'chip gray', expired: 'chip gray' };

export function PerksScreen() {
  const { refresh, toast, fail } = useApp();
  const { t, L } = useT();
  const { run, pending } = useOnce();
  const [data, setData] = useState<Perks | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [asking, setAsking] = useState<Coupon | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setData(await api<Perks>('GET', '/coupons'));
    } catch (e) {
      setErr(errorText(t, e));
    }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const close = useCallback(() => {
    setAsking(null);
    opener.current?.focus();
  }, []);

  const confirm = async (c: Coupon) => {
    try {
      const r = await run((requestId) => api<Coupon>('POST', `/coupons/${c.id}/use`, { requestId }));
      if (!r) return;
      beep('ok');
      setAsking(null);
      toast(t('usedToast'));
      await load();
      await refresh();
    } catch (e) {
      setAsking(null);
      fail(e, () => void load());
    }
  };

  const shown = data ? sortCoupons(data.coupons) : [];
  return (
    <Frame title={t('perks')}>
      <p className="lead top4">{t('perksLead')}</p>
      {err && (
        <div className="problem" role="alert"><p>{err}</p>
          <button type="button" className="btn primary sm" onClick={() => void load()}>{t('retry')}</button></div>
      )}
      {!data && !err && <p className="card loading" role="status">{t('loading')}</p>}
      {data && (
        <>
          <div className="card stamps gap16" data-testid="stamps">
            <div className="row gap6" aria-hidden="true">
              {Array.from({ length: Math.min(4, data.stamps) }, (_, i) => <span key={i} className="st"><Icon name="check" size={22} /></span>)}
            </div>
            <b className="mlauto">{t('stampsN', { n: data.stamps })}</b>
          </div>
          {shown.length === 0 && <p className="card gap16">{t('noCoupons')}</p>}
          {shown.map((c) => (
            <article key={c.id} className={`cp${c.status === 'used' || c.status === 'expired' ? ' used' : ''}`} data-testid="coupon" data-status={c.status} data-id={c.id}>
              {c.status === 'used' && <span className="usedmark" aria-hidden="true">{t('st_used')}</span>}
              <div className="top2">
                <div className="ic"><Icon name={c.status === 'later' ? 'lock' : 'gift'} size={26} /></div>
                <div className="grow">
                  <span className="muted">{L(couponShop(c))}</span>
                  <b>{L(couponLabel(c))}</b>
                  <span className={CHIP[c.status]}>{t(`st_${c.status}`)}</span>
                  {c.isNew && <span className="newb">{t('newMark')}</span>}
                </div>
              </div>
              <div className="cut" />
              <dl>
                <dt>{t('shopL')}</dt><dd>{L(couponShop(c))}</dd>
                <dt>{t('limitL')}</dt><dd>{ymd(t, c.expires)}</dd>
                {c.status === 'usable' && <><dt>{t('perkHow')}</dt><dd>{t('perkHowText')}</dd></>}
              </dl>
              <div className="foot">
                {c.status === 'usable' && (
                  <button type="button" className="btn accent sm" data-testid="use" onClick={(e) => { opener.current = e.currentTarget; setAsking(c); }}>
                    <Icon name="ticket" size={20} />{t('use')}
                  </button>
                )}
                {c.status === 'later' && <div className="lock"><Icon name="lock" size={18} /><span>{t('laterNote', { d: ymd(t, c.usableFrom) })}</span></div>}
              </div>
            </article>
          ))}
        </>
      )}
      {asking && <ConfirmUse coupon={asking} pending={pending} onUse={() => void confirm(asking)} onClose={close} />}
    </Frame>
  );
}

function ConfirmUse({ coupon, pending, onUse, onClose }: { coupon: Coupon; pending: boolean; onUse: () => void; onClose: () => void }) {
  const { t, L } = useT();
  const useBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    useBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-h" data-testid="confirm">
        <h2 id="dlg-h">{t('confirmTitle')}</h2>
        <div className="what">{L(couponLabel(coupon))}<div className="muted">{L(couponShop(coupon))}</div></div>
        <p className="gap18b">{t('confirmBody')}</p>
        <button ref={useBtn} type="button" className="btn primary" data-testid="confirm-use" disabled={pending} onClick={onUse}><Icon name="check" size={22} />{t('use')}</button>
        <button type="button" className="btn ghost" data-testid="confirm-cancel" onClick={onClose}>{t('cancel')}</button>
      </div>
    </div>
  );
}
