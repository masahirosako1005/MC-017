// SC-05 すごろく（index.html の play、SC-05 のモック）。目はサーバーが決める（ADR-007）。素早い2回押しでも1回だけ送る（useOnce）。
// 振ると、さいころが画面いっぱいに出て転がり、止まったら（または「とばす」で）閉じて駒が1マスずつ進む（SC-05 §12、ADR-022）。
import { useCallback, useEffect, useRef, useState } from 'react';
import { BOARD_SIZE, GOAL, nextGift } from '../../../shared/board.ts';
import type { MeState, RollResult } from '../../../shared/schemas.ts';
import { api } from '../api.ts';
import { useApp } from '../app-context.ts';
import { Board } from '../board/Board.tsx';
import { Confetti } from '../board/Confetti.tsx';
import { Congrats } from '../board/Congrats.tsx';
import { couponWithShop, giftType } from '../../../shared/master/coupons.ts';
import { DiceOverlay } from '../board/DiceOverlay.tsx';
import { RollOutcome, RollQuick } from '../board/RollOutcome.tsx';
import { takeGain } from '../gain.ts';
import { useT } from '../i18n/index.ts';
import { useOnce } from '../use-once.ts';
import { Frame } from '../ui/Frame.tsx';
import { Icon } from '../ui/Icon.tsx';
import { beep } from '../sfx.ts';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 転がる時間（R-023: 約4.8秒、動きを減らす設定では約0.5秒）。止まってから閉じるまでの間（目を見せる）は HOLD_MS */
export const SPIN_MS = 4800;
export const SPIN_REDUCED_MS = 500;
export const HOLD_MS = 1200;
const HOLD_REDUCED_MS = 700;
/** 「とばす」「すすむ」を押したあとの短い間 */
const HOLD_SKIPPED_MS = 700; // 目が見える長さ（200msでは見えないことがあった）
const SKIP_GUARD_MS = 500;

interface DiceState {
  open: boolean;
  face: number | null;
  landed: boolean;
  moves: number;
  instant: boolean;
}

export function PlayScreen() {
  const { me, setMe, demoMode, refresh, fail, go } = useApp();
  const { t, L } = useT();
  const { run } = useOnce();
  const demoOnce = useOnce();
  useState(takeGain); // 獲得の知らせは画面に出さない（説明文の削除）が、読み出して消しておく
  const [shown, setShown] = useState<{ no: number; pos: number } | null>(null);
  const [rolling, setRolling] = useState(false);
  const [hop, setHop] = useState(0);
  const [reveal, setReveal] = useState(0);
  const [result, setResult] = useState<RollResult | null>(null);
  const [party, setParty] = useState(false);
  const [congrats, setCongrats] = useState<{ coupon: string; discount: boolean } | null>(null);
  const [seq, setSeq] = useState(0);
  const [dice, setDice] = useState<DiceState>({ open: false, face: null, landed: false, moves: 0, instant: false });
  const busy = useRef(false);
  const skipped = useRef(false);
  const openedAt = useRef(0);
  const queued = useRef(false);
  const meRef = useRef(me);
  meRef.current = me;
  const wake = useRef<(() => void) | null>(null);
  const rollBtn = useRef<HTMLButtonElement>(null);
  const board = shown ?? { no: me.board.no, pos: me.board.pos };
  const giftAt = nextGift(board.no, board.pos);

  useEffect(() => {
    if (!party) return;
    const id = setTimeout(() => setParty(false), reduced() ? 900 : 2600);
    return () => clearTimeout(id);
  }, [party]);

  /** 待つ。「とばす」「すすむ」で途中で切り上げる。fresh でなければ、すでに押されていれば待たない */
  function pause(ms: number, fresh = false): Promise<void> {
    if (!fresh && skipped.current) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => { clearTimeout(id); wake.current = null; resolve(); };
      const id = setTimeout(done, ms);
      wake.current = done;
    });
  }

  /** 開いた直後の「とばす」は、少し待ってから効かせる（「振る」の連打・二度押しで、さいころが一瞬で閉じるのを防ぐ） */
  function skip(): void {
    const wait = Math.max(0, SKIP_GUARD_MS - (Date.now() - openedAt.current));
    if (wait > 0) {
      setTimeout(() => { if (busy.current) skip(); }, wait);
      return;
    }
    skipped.current = true;
    setDice((d) => ({ ...d, instant: true }));
    wake.current?.();
  }

  /** 転がっている間の「こつこつ」音。だんだん間をあける */
  async function tick(total: number, calm: boolean): Promise<void> {
    const end = Date.now() + total;
    let gap = calm ? 250 : 180;
    while (Date.now() < end && !skipped.current) {
      beep('tick');
      await pause(Math.min(gap, end - Date.now()));
      gap = Math.min(gap * 1.22, 700);
    }
  }

  async function roll(): Promise<void> {
    if (busy.current) {
      // 駒が進んでいる間に押されたら、終わってからもう一度振る（黙って無視しない）
      queued.current = true;
      return;
    }
    if (me.rollsLeft < 1) return;
    busy.current = true;
    skipped.current = false;
    openedAt.current = Date.now();
    setRolling(true);
    setResult(null);
    setParty(false);
    setCongrats(null);
    setSeq((n) => n + 1); // 振るたびに、さいころの絵を作り直す（前の回の絵・動きを引き継がない）
    setDice({ open: true, face: null, landed: false, moves: 0, instant: false });
    try {
      const calm = reduced();
      const r = await run((requestId) => api<RollResult>('POST', '/rolls', { requestId }));
      if (!r) return;
      const moves = r.to - r.from;
      // 残り回数はサーバーの答え（「もう1回」マスの +1 を含む）をすぐ反映する。あとの /me の取得が遅れても「振れません」にならない
      setMe({ ...meRef.current, rollsLeft: r.rollsLeft });
      setDice({ open: true, face: r.face, landed: false, moves, instant: calm || skipped.current });
      await tick(calm ? SPIN_REDUCED_MS : SPIN_MS, calm);
      setRolling(false);
      setDice({ open: true, face: r.face, landed: true, moves, instant: calm || skipped.current });
      await pause(skipped.current ? HOLD_SKIPPED_MS : calm ? HOLD_REDUCED_MS : HOLD_MS, true);
      setDice((d) => ({ ...d, open: false }));
      rollBtn.current?.focus({ preventScroll: true });
      if (!calm) await sleep(250);
      setShown({ no: r.boardNo, pos: r.from });
      setReveal((n) => n + 1);
      if (!calm) await sleep(350);
      for (let p = r.from + 1; p <= r.to; p += 1) {
        await sleep(calm ? 40 : 260);
        setShown({ no: r.boardNo, pos: p });
        if (!calm) setHop((h) => h + 1);
        beep('step');
      }
      if (r.landed.kind === 'goal') {
        beep('fanfare');
        setParty(true);
      } else if (r.landed.kind === 'gift') {
        beep('perk');
        setCongrats({ coupon: L(couponWithShop(r.landed.coupon)), discount: giftType(r.boardNo, r.to) === 'discount' });
      } else if (r.landed.kind === 'shop' || r.landed.kind === 'again') {
        beep('gift');
      }
      setResult(r);
      await refresh();
      setShown(null);
    } catch (err) {
      setShown(null);
      fail(err, () => void roll());
    } finally {
      busy.current = false;
      setRolling(false);
      setDice((d) => ({ ...d, open: false }));
      if (queued.current) {
        queued.current = false;
        setTimeout(() => void rollRef.current(), 50); // 描き直し後の最新の回数で判定する
      }
    }
  }
  const rollRef = useRef(roll);
  rollRef.current = roll;

  /** デモ用: さいころの回数を1回ずつ足す（DEMO_MODE のときだけ表示。ADR-008） */
  async function demoPlusOne(): Promise<void> {
    try {
      const r = await demoOnce.run((requestId) => api<MeState>('POST', '/demo/rolls', { requestId, amount: 1 }));
      if (r) setMe(r);
    } catch (err) {
      fail(err, () => void demoPlusOne());
    }
  }

  const closeCongrats = useCallback(() => {
    setCongrats(null);
    rollBtn.current?.focus({ preventScroll: true });
  }, []);

  const canRoll = me.rollsLeft > 0;
  const quick = result && !rolling ? <RollQuick result={result} /> : null;
  const action = canRoll ? (
    <>
      {quick}
      <button type="button" className="btn primary" ref={rollBtn} aria-disabled={rolling ? 'true' : undefined} onClick={() => void roll()} data-testid="roll">
        <Icon name="dice" size={26} />{t('roll', { n: me.rollsLeft })}
      </button>
    </>
  ) : (
    <>
      {quick}
      <p className="hint" data-testid="no-roll">{t('noRoll')}</p>
      <button type="button" className="btn ghost" onClick={() => go('spots')}><Icon name="pin" size={22} />{t('findSpots')}</button>
    </>
  );

  return (
    <Frame title={t('playTitle')} action={action}>
      <div className="card boardcard">
        <div className="boardwrap">
          <Board boardNo={board.no} pos={board.pos} avatar={me.profile.avatar} hop={hop} reveal={reveal} extras={me.board.extras} />
          {result && <RollOutcome result={result} part="buddy" />}
        </div>
        <p className="sr-only" data-testid="board-text">
          {t('boardText', {
            pos: board.pos + 1, size: BOARD_SIZE, goal: GOAL - board.pos,
            gift: giftAt === null ? t('boardGiftNone') : t('boardGiftN', { n: giftAt - board.pos }),
          })}
        </p>
        <div aria-live="polite" className="live" data-testid="roll-live">
          {rolling && <span className="sr-only">{t('rolling')}</span>}
          {result && <RollOutcome result={result} part="card" />}
        </div>
        <ul className="legend" data-testid="board-legend">
          <li className="g"><Icon name="gift" size={14} />{t('legendPresent')}</li>
          <li className="d"><Icon name="percent" size={14} />{t('legendDiscount')}</li>
          <li className="a"><Icon name="again" size={14} />{t('legendAgain')}</li>
          <li><Icon name="pin" size={14} />{t('legendSpot')}</li>
          {me.board.extras.length > 0 && <li className="g"><Icon name="bag" size={14} />{t('legendShop')}</li>}
          {board.no > 1 && <li className="g"><Icon name="star" size={14} />{t('legendSeason')}</li>}
        </ul>
        {demoMode && (
          <button type="button" className="demo-more" disabled={demoOnce.pending} onClick={() => void demoPlusOne()} data-testid="demo-roll-plus1">
            {t('demoRollPlus1')}
          </button>
        )}
      </div>
      {party && <Confetti reduced={reduced()} />}
      {congrats && <Congrats coupon={congrats.coupon} discount={congrats.discount} reduced={reduced()} onClose={closeCongrats} />}
      <DiceOverlay seq={seq} open={dice.open} face={dice.face} landed={dice.landed} moves={dice.moves} instant={dice.instant} duration={SPIN_MS} onSkip={skip} />
    </Frame>
  );
}




