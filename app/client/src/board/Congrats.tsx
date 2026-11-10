// プレゼント・割引マスに止まったときの全画面の「おめでとう」。紙吹雪は落ちるだけで点滅しない（WCAG 2.3.1）。
import { useEffect, useRef } from 'react';
import { useT } from '../i18n/index.ts';
import { Confetti } from './Confetti.tsx';
import { Cracker } from './Cracker.tsx';

const SHOW_MS = 5000;

interface Props {
  /** 「お店の名前 券の名前」 */
  coupon: string;
  discount: boolean;
  reduced: boolean;
  onClose: () => void;
}

export function Congrats({ coupon, discount, reduced, onClose }: Props) {
  const { t } = useT();
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
    const id = setTimeout(onClose, SHOW_MS);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(id); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div className={`congrats${reduced ? ' calm' : ''}`} role="dialog" aria-modal="true" aria-labelledby="cg-h" data-testid="congrats" data-type={discount ? 'discount' : 'present'}>
      <Confetti reduced={reduced} />
      <div className="cg-box">
        <span className="cg-big"><Cracker /></span>
        <h2 id="cg-h">{t('congratsTitle')}</h2>
        <p className="cg-sub">{t(discount ? 'congratsDiscount' : 'congratsPresent')}</p>
        <p className="cg-coupon" data-testid="congrats-coupon">{coupon}</p>
        <button ref={btn} type="button" className="btn primary" data-testid="congrats-close" onClick={onClose}>{t('congratsClose')}</button>
      </div>
    </div>
  );
}
