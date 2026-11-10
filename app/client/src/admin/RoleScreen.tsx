// SC-A01 役割を選ぶ。ログインは無く、役割（観光協会 / 店）を選ぶだけ。
import { useState, type FormEvent } from 'react';
import type { Operator } from '../../../shared/admin.ts';
import { SHOP_IDS, isShopId } from '../../../shared/master/campaigns.ts';
import { operatorOfShop, shopName } from './role.ts';
import { ErrorLine } from './widgets.tsx';

const NEED_SHOP = 'お店をえらんでください';

export function RoleScreen({ onPick }: { onPick: (op: Operator) => void }) {
  const [shopOpen, setShopOpen] = useState(false);
  const [shop, setShop] = useState('');
  const [error, setError] = useState('');

  function go(e: FormEvent) {
    e.preventDefault();
    if (!isShopId(shop)) {
      setError(NEED_SHOP);
      return;
    }
    onPick(operatorOfShop(shop));
  }

  return (
    <div data-testid="screen-role">
      <h1>役割を選ぶ</h1>
      <p className="lead">ログインの代わりに、役割をえらびます。店舗は自分の店の数字だけを見られます。</p>
      <div className="roles">
        <div className="rolebtn assoc">
          <button type="button" className="rolepick" data-testid="role-association" onClick={() => onPick('association')}>
            <b>観光協会</b>
            <span className="small">全体の分析</span>
          </button>
        </div>
        <div className="rolebtn shop">
          <button
            type="button"
            className="rolepick"
            data-testid="role-shop"
            aria-expanded={shopOpen}
            aria-controls="shop-form"
            onClick={() => setShopOpen((v) => !v)}
          >
            <b>店舗</b>
            <span className="small">自分の店の数字・お客さまの声・特典マス</span>
          </button>
          {shopOpen ? (
            <form id="shop-form" data-testid="shop-form" noValidate onSubmit={go}>
              <div className="f">
                <label htmlFor="shop-pick">お店</label>
                <select
                  id="shop-pick"
                  data-testid="shop-pick"
                  value={shop}
                  aria-describedby="shop-err"
                  onChange={(e) => {
                    setShop(e.target.value);
                    setError('');
                  }}
                >
                  <option value="">{NEED_SHOP}</option>
                  {SHOP_IDS.map((id) => (
                    <option key={id} value={id}>{shopName(id)}</option>
                  ))}
                </select>
              </div>
              <div id="shop-err"><ErrorLine text={error} /></div>
              <div className="actions">
                <button type="submit" className="btn" data-testid="shop-go">進む</button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
      <p className="small note">この画面は、役割ごとの認証を作っていません。このPCの中（127.0.0.1）だけで動きます。</p>
    </div>
  );
}
