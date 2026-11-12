import { useEffect, useState } from 'react';
import { useAccount, useUI, toast, FEE_SPOT, FEE_FUT, MAX_LEV, liqPrice } from '../store';
import { usePrices, changeOf, priceOf, INTERVALS } from '../prices';
import { fmtCompact, fmtPrice, fmtQty, fmtUsd, num, toInput, dp } from '../format';
import Chart from '../components/Chart';
import OrderBook from '../components/OrderBook';
import { CoinIcon, CoinPicker, Field, LiveBadge, Pct, Sheet } from '../components/ui';
import { HistoryList, OrdersList, PositionsList, TransferSheet, Empty } from '../components/lists';

const PCTS = [0.25, 0.5, 0.75, 1];

function TypeTabs({ type, set }: { type: 'market' | 'limit'; set(t: 'market' | 'limit'): void }) {
  return (
    <div className="seg small">
      <button className={type === 'market' ? 'on' : ''} onClick={() => set('market')}>
        Ринковий
      </button>
      <button className={type === 'limit' ? 'on' : ''} onClick={() => set('limit')}>
        Лімітний
      </button>
    </div>
  );
}

function PctRow({ value, onPick }: { value: number | null; onPick(f: number): void }) {
  return (
    <div className="pcts">
      {PCTS.map((f) => (
        <button key={f} className={value === f ? 'on' : ''} onClick={() => onPick(f)}>
          {f * 100}%
        </button>
      ))}
    </div>
  );
}

/* ============================ СПОТ ============================ */
function SpotForm({ sym, pick }: { sym: string; pick: number }) {
  const cur = usePrices((s) => s.p[sym].price);
  const usdt = useAccount((s) => s.usdt);
  const hold = useAccount((s) => s.spot[sym]?.qty ?? 0);
  const spotOrder = useAccount((s) => s.spotOrder);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [total, setTotal] = useState('');
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    setQty('');
    setTotal('');
    setPct(null);
    setPrice('');
  }, [sym]);
  useEffect(() => {
    if (pick > 0) {
      setType('limit');
      setPrice(toInput(pick, dp(pick)));
    }
  }, [pick]);

  const px = type === 'limit' && num(price) > 0 ? num(price) : cur;
  const calc = (f: number) => {
    if (side === 'buy') {
      const t = (usdt * f) / (1 + FEE_SPOT);
      return { q: t / px, t };
    }
    return { q: hold * f, t: hold * f * px };
  };

  const onPct = (f: number) => {
    const { q, t } = calc(f);
    setPct(f);
    setQty(toInput(q, 8));
    setTotal(toInput(t, 2));
  };

  const submit = () => {
    const livePx = type === 'limit' && num(price) > 0 ? num(price) : priceOf(sym);
    let q = num(qty);
    if (pct !== null) q = side === 'buy' ? (usdt * pct) / (1 + FEE_SPOT) / livePx : hold * pct;
    if (type === 'limit' && !(num(price) > 0)) return toast('Введи ціну ліміту', 'bad');
    const e = spotOrder({ sym, side, qty: q, limit: type === 'limit' ? num(price) : undefined });
    if (e) return toast(e, 'bad');
    const pending = type === 'limit' && (side === 'buy' ? num(price) < priceOf(sym) : num(price) > priceOf(sym));
    toast(pending ? 'Лімітний ордер створено' : side === 'buy' ? `Куплено ${fmtQty(q)} ${sym}` : `Продано ${fmtQty(q)} ${sym}`, 'ok');
    setQty('');
    setTotal('');
    setPct(null);
  };

  return (
    <div className="form">
      <div className="seg sides">
        <button className={side === 'buy' ? 'on buy' : ''} onClick={() => (setSide('buy'), setPct(null), setQty(''), setTotal(''))}>
          Купити
        </button>
        <button className={side === 'sell' ? 'on sell' : ''} onClick={() => (setSide('sell'), setPct(null), setQty(''), setTotal(''))}>
          Продати
        </button>
      </div>
      <TypeTabs type={type} set={setType} />
      {type === 'limit' ? (
        <Field label="Ціна" unit="USDT" value={price} onChange={setPrice} placeholder={fmtPrice(cur)} />
      ) : (
        <Field label="Ціна" value="Ринкова" disabled />
      )}
      <Field
        label="Кількість"
        unit={sym}
        value={qty}
        onChange={(v) => {
          setQty(v);
          setPct(null);
          setTotal(toInput(num(v) * px, 2));
        }}
      />
      <PctRow value={pct} onPick={onPct} />
      <Field
        label="Сума"
        unit="USDT"
        value={total}
        onChange={(v) => {
          setTotal(v);
          setPct(null);
          setQty(toInput(num(v) / px, 8));
        }}
      />
      <div className="avail">
        <span>Доступно</span>
        <b>{side === 'buy' ? `${fmtUsd(usdt)} USDT` : `${fmtQty(hold)} ${sym}`}</b>
      </div>
      <button className={'btn block ' + (side === 'buy' ? 'green' : 'red')} onClick={submit}>
        {side === 'buy' ? 'Купити' : 'Продати'} {sym}
      </button>
    </div>
  );
}

/* ============================ Ф'ЮЧЕРСИ ============================ */
function FutForm({ sym, pick }: { sym: string; pick: number }) {
  const cur = usePrices((s) => s.p[sym].price);
  const bal = useAccount((s) => s.futUsdt);
  const futOrder = useAccount((s) => s.futOrder);
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [price, setPrice] = useState('');
  const [margin, setMargin] = useState('');
  const [pct, setPct] = useState<number | null>(null);
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [lev, setLev] = useState(() => Math.min(MAX_LEV, Math.max(1, +(localStorage.getItem('dt_lev') || 10) || 10)));
  const [levOpen, setLevOpen] = useState(false);
  const [transfer, setTransfer] = useState(false);

  useEffect(() => {
    setPrice('');
    setTp('');
    setSl('');
  }, [sym]);
  useEffect(() => {
    if (pick > 0) {
      setType('limit');
      setPrice(toInput(pick, dp(pick)));
    }
  }, [pick]);
  useEffect(() => {
    localStorage.setItem('dt_lev', String(lev));
  }, [lev]);

  const maxMargin = (f: number) => (bal * f) / (1 + lev * FEE_FUT);
  const m = pct !== null ? maxMargin(pct) : num(margin);
  const px = type === 'limit' && num(price) > 0 ? num(price) : cur;
  const notional = m * lev;
  const qty = notional / px;

  const submit = (side: 'long' | 'short') => {
    if (type === 'limit' && !(num(price) > 0)) return toast('Введи ціну ліміту', 'bad');
    const mg = pct !== null ? maxMargin(pct) : num(margin);
    const e = futOrder({
      sym,
      side,
      margin: mg,
      lev,
      limit: type === 'limit' ? num(price) : undefined,
      tp: num(tp) || undefined,
      sl: num(sl) || undefined,
    });
    if (e) return toast(e, 'bad');
    const c = priceOf(sym);
    const pending = type === 'limit' && (side === 'long' ? num(price) < c : num(price) > c);
    toast(pending ? 'Лімітний ордер створено' : `${side === 'long' ? 'Лонг' : 'Шорт'} ${sym} ${lev}x відкрито`, 'ok');
    setMargin('');
    setPct(null);
    setTp('');
    setSl('');
  };

  return (
    <div className="form">
      <div className="lev-row">
        <span className="chip">Ізольована</span>
        <button className="chip accent" onClick={() => setLevOpen(true)}>
          Плече {lev}x ▾
        </button>
      </div>
      <TypeTabs type={type} set={setType} />
      {type === 'limit' ? (
        <Field label="Ціна" unit="USDT" value={price} onChange={setPrice} placeholder={fmtPrice(cur)} />
      ) : (
        <Field label="Ціна" value="Ринкова" disabled />
      )}
      <Field
        label="Маржа"
        unit="USDT"
        value={pct !== null ? toInput(m, 2) : margin}
        onChange={(v) => {
          setMargin(v);
          setPct(null);
        }}
      />
      <PctRow
        value={pct}
        onPick={(f) => {
          setPct(f);
          setMargin('');
        }}
      />
      <div className="two">
        <Field label="TP" value={tp} onChange={setTp} placeholder="—" />
        <Field label="SL" value={sl} onChange={setSl} placeholder="—" />
      </div>
      <div className="info">
        <div>
          <span>Розмір позиції</span>
          <b>{fmtUsd(notional)} USDT</b>
        </div>
        <div>
          <span>Кількість</span>
          <b>
            {m > 0 ? fmtQty(qty) : '0'} {sym}
          </b>
        </div>
        {m > 0 && (
          <div>
            <span>Ліквідація L / S</span>
            <b className="warn">
              {fmtPrice(liqPrice({ side: 'long', qty, entry: px, margin: m }))} /{' '}
              {fmtPrice(liqPrice({ side: 'short', qty, entry: px, margin: m }))}
            </b>
          </div>
        )}
      </div>
      <div className="avail">
        <span>Доступно</span>
        <b>
          {fmtUsd(bal)} USDT{' '}
          <button className="link" onClick={() => setTransfer(true)}>
            ⇄
          </button>
        </b>
      </div>
      {bal < 1 ? (
        <button className="btn block primary" onClick={() => setTransfer(true)}>
          Переказати USDT на ф’ючерси
        </button>
      ) : (
        <div className="two">
          <button className="btn green" onClick={() => submit('long')}>
            Лонг ↑
          </button>
          <button className="btn red" onClick={() => submit('short')}>
            Шорт ↓
          </button>
        </div>
      )}

      {levOpen && (
        <Sheet title="Кредитне плече" onClose={() => setLevOpen(false)}>
          <div className="lev-big">{lev}x</div>
          <input
            type="range"
            min={1}
            max={MAX_LEV}
            value={lev}
            onChange={(e) => setLev(+e.target.value)}
            className="range"
            style={{ ['--f' as string]: ((lev - 1) / (MAX_LEV - 1)) * 100 + '%' }}
          />
          <div className="pcts">
            {[1, 5, 10, 25, 50, 100].map((v) => (
              <button key={v} className={lev === v ? 'on' : ''} onClick={() => setLev(v)}>
                {v}x
              </button>
            ))}
          </div>
          <p className="muted pad">
            Чим більше плече, тим ближче ціна ліквідації. При {lev}x позиція згорить, якщо ціна піде проти тебе приблизно на{' '}
            {(100 / lev - 0.5).toFixed(1)}%.
          </p>
          <button className="btn primary block" onClick={() => setLevOpen(false)}>
            Готово
          </button>
        </Sheet>
      )}
      {transfer && <TransferSheet onClose={() => setTransfer(false)} />}
    </div>
  );
}

function SpotAssets() {
  const spot = useAccount((s) => s.spot);
  const p = usePrices((s) => s.p);
  const go = useUI((s) => s.go);
  const syms = Object.keys(spot);
  if (!syms.length) return <Empty text="Монет поки немає - купи першу" />;
  return (
    <div className="list">
      {syms.map((sym) => {
        const h = spot[sym];
        const val = h.qty * p[sym].price;
        const pnl = val - h.cost;
        return (
          <button className="row" key={sym} onClick={() => go('spot', sym)}>
            <CoinIcon sym={sym} size={30} />
            <span className="row-main">
              <b>{sym}</b>
              <span className="muted">{fmtQty(h.qty)}</span>
            </span>
            <span className="row-end">
              <b>{fmtUsd(val)} $</b>
              <span className={pnl >= 0 ? 'up' : 'down'}>
                {pnl >= 0 ? '+' : ''}
                {fmtUsd(pnl)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================ ЕКРАН ============================ */
export default function Trade({ mode }: { mode: 'spot' | 'fut' }) {
  const sym = useUI((s) => s.sym);
  const go = useUI((s) => s.go);
  const t = usePrices((s) => s.p[sym]);
  const fav = useAccount((s) => s.favs.includes(sym));
  const toggleFav = useAccount((s) => s.toggleFav);
  const nOrders = useAccount((s) => s.orders.filter((o) => o.kind === mode).length);
  const nPos = useAccount((s) => s.positions.length);
  const [iv, setIv] = useState('15m');
  const [picker, setPicker] = useState(false);
  const [pick, setPick] = useState(0);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    setPick(0);
  }, [sym, mode]);
  useEffect(() => {
    setTab(0);
  }, [mode]);

  const ch = changeOf(t);
  const tabs = mode === 'spot' ? [`Ордери (${nOrders})`, 'Активи', 'Історія'] : [`Позиції (${nPos})`, `Ордери (${nOrders})`, 'Історія'];

  return (
    <div className="screen">
      <div className="topbar">
        <button className="pair" onClick={() => setPicker(true)}>
          <CoinIcon sym={sym} size={28} />
          <b>{sym}/USDT</b>
          {mode === 'fut' && <span className="tag accent">Безстр.</span>}
          <span className="caret">▾</span>
        </button>
        <span className="grow" />
        <LiveBadge />
        <button className={'star' + (fav ? ' on' : '')} onClick={() => toggleFav(sym)} aria-label="Обране">
          {fav ? '★' : '☆'}
        </button>
      </div>

      <div className="quote">
        <div>
          <div className={'big ' + (ch >= 0 ? 'up' : 'down')}>{fmtPrice(t.price)}</div>
          <Pct v={ch} />
        </div>
        <div className="stats">
          <div>
            <span>24г макс</span>
            <b>{fmtPrice(t.high)}</b>
          </div>
          <div>
            <span>24г мін</span>
            <b>{fmtPrice(t.low)}</b>
          </div>
          <div>
            <span>Обсяг</span>
            <b>{fmtCompact(t.vol)}</b>
          </div>
        </div>
      </div>

      <div className="ivs">
        {INTERVALS.map((i) => (
          <button key={i.id} className={iv === i.id ? 'on' : ''} onClick={() => setIv(i.id)}>
            {i.label}
          </button>
        ))}
      </div>
      <Chart sym={sym} iv={iv} />

      <div className="tradegrid">
        {mode === 'spot' ? <SpotForm sym={sym} pick={pick} /> : <FutForm sym={sym} pick={pick} />}
        <OrderBook sym={sym} onPick={setPick} />
      </div>

      <div className="tabs">
        {tabs.map((x, i) => (
          <button key={i} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>
            {x}
          </button>
        ))}
      </div>
      {mode === 'spot' ? (
        tab === 0 ? <OrdersList kind="spot" /> : tab === 1 ? <SpotAssets /> : <HistoryList kind="spot" />
      ) : tab === 0 ? (
        <PositionsList />
      ) : tab === 1 ? (
        <OrdersList kind="fut" />
      ) : (
        <HistoryList kind="fut" />
      )}

      {picker && (
        <CoinPicker
          onClose={() => setPicker(false)}
          onPick={(s) => {
            go(mode, s);
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
