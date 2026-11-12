import { useMemo } from 'react';
import { usePrices } from '../prices';
import { dp, fmtPrice, fmtCompact } from '../format';

/** Імітація стакана навколо поточної ціни */
export default function OrderBook({ sym, onPick }: { sym: string; onPick?(price: number): void }) {
  const t = usePrices((s) => s.p[sym]);
  const book = useMemo(() => {
    const p = t.price;
    const step = Math.max(1 / 10 ** dp(p), p * 0.00012);
    const mk = (dir: 1 | -1) => {
      let acc = 0;
      return Array.from({ length: 7 }, (_, i) => {
        const price = p + dir * step * (i + 1 + Math.random() * 0.6);
        const usd = (300 + Math.random() * 9000) * (1 + i * 0.35);
        acc += usd;
        return { price, qty: usd / price, acc };
      });
    };
    const asks = mk(1);
    const bids = mk(-1);
    const max = Math.max(asks[6].acc, bids[6].acc);
    return { asks: asks.reverse(), bids, max };
  }, [t.price]);

  const row = (r: { price: number; qty: number; acc: number }, side: 'ask' | 'bid', i: number) => (
    <button key={side + i} className={'ob-row ' + side} onClick={() => onPick?.(r.price)}>
      <i style={{ width: (r.acc / book.max) * 100 + '%' }} />
      <span>{fmtPrice(r.price)}</span>
      <span>{fmtCompact(r.qty)}</span>
    </button>
  );

  return (
    <div className="ob">
      <div className="ob-head">
        <span>Ціна</span>
        <span>К-сть</span>
      </div>
      {book.asks.map((r, i) => row(r, 'ask', i))}
      <div className={'ob-mid ' + (t.price >= t.open ? 'up' : 'down')}>{fmtPrice(t.price)}</div>
      {book.bids.map((r, i) => row(r, 'bid', i))}
    </div>
  );
}
