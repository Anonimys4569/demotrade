import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';
import { priceOf, type Tick } from './prices';

/* ------------------------------------------------------------------
   Рахунок користувача. Все зберігається на пристрої
   (Capacitor Preferences: UserDefaults на iOS, SharedPreferences на Android,
   localStorage у браузері) - сервер не потрібен.
------------------------------------------------------------------- */

export const START_BALANCE = 10000;
export const FEE_SPOT = 0.001; // 0.1%
export const FEE_FUT = 0.0005; // 0.05%
export const MMR = 0.005; // підтримуюча маржа
export const MAX_LEV = 100;

export interface Holding {
  qty: number;
  cost: number; // скільки USDT витрачено на цю кількість
}

export interface Position {
  id: string;
  sym: string;
  side: 'long' | 'short';
  qty: number;
  entry: number;
  margin: number;
  lev: number;
  tp?: number;
  sl?: number;
  t: number;
}

export interface Order {
  id: string;
  kind: 'spot' | 'fut';
  sym: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  price: number;
  qty: number;
  locked: number; // заблоковані USDT (або собівартість монет для spot sell)
  lev?: number;
  margin?: number;
  tp?: number;
  sl?: number;
  t: number;
}

export interface Trade {
  id: string;
  t: number;
  kind: 'spot' | 'fut';
  sym: string;
  label: string;
  good: boolean; // зелений чи червоний колір
  price: number;
  qty: number;
  pnl?: number;
}

interface Data {
  usdt: number;
  spot: Record<string, Holding>;
  futUsdt: number;
  positions: Position[];
  orders: Order[];
  history: Trade[];
  equity: { t: number; v: number }[];
  favs: string[];
  forceSim: boolean;
}

interface Actions {
  spotOrder(a: { sym: string; side: 'buy' | 'sell'; qty: number; limit?: number }): string | null;
  futOrder(a: {
    sym: string;
    side: 'long' | 'short';
    margin: number;
    lev: number;
    limit?: number;
    tp?: number;
    sl?: number;
  }): string | null;
  closePosition(id: string, frac: number): void;
  setTpSl(id: string, tp?: number, sl?: number): string | null;
  cancelOrder(id: string): void;
  transfer(to: 'fut' | 'spot', amount: number): string | null;
  toggleFav(sym: string): void;
  setForceSim(v: boolean): void;
  reset(): void;
  importData(json: string): string | null;
  tick(p: Record<string, Tick>): void;
}

export type Account = Data & Actions;

const fresh = (): Data => ({
  usdt: START_BALANCE,
  spot: {},
  futUsdt: 0,
  positions: [],
  orders: [],
  history: [],
  equity: [{ t: Date.now(), v: START_BALANCE }],
  favs: ['BTC', 'ETH', 'SOL'],
  forceSim: false,
});

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const EPS = 1e-9;

/* ---------- сповіщення (тости) ---------- */
export const useToast = create<{ msg: string; kind: 'ok' | 'bad' | 'info'; n: number }>(() => ({
  msg: '',
  kind: 'info',
  n: 0,
}));
export const toast = (msg: string, kind: 'ok' | 'bad' | 'info' = 'info') =>
  useToast.setState((s) => ({ msg, kind, n: s.n + 1 }));

/* ---------- формули ---------- */
export const liqPrice = (pos: Pick<Position, 'side' | 'qty' | 'entry' | 'margin'>) => {
  const mm = pos.qty * pos.entry * MMR;
  const d = (pos.margin - mm) / pos.qty;
  return Math.max(0, pos.side === 'long' ? pos.entry - d : pos.entry + d);
};
export const posPnl = (pos: Position, price: number) =>
  (pos.side === 'long' ? price - pos.entry : pos.entry - price) * pos.qty;

export function totalEquity(s: Data, p: Record<string, Tick>) {
  let v = s.usdt + s.futUsdt;
  for (const sym in s.spot) v += s.spot[sym].qty * (p[sym]?.price ?? 0);
  for (const o of s.orders) {
    if (o.kind === 'spot' && o.side === 'sell') v += o.qty * (p[o.sym]?.price ?? 0);
    else v += o.locked;
  }
  for (const pos of s.positions) v += Math.max(0, pos.margin + posPnl(pos, p[pos.sym]?.price ?? pos.entry));
  return v;
}

/* ---------- внутрішні операції над чернеткою ---------- */
type Draft = Pick<Data, 'usdt' | 'spot' | 'futUsdt' | 'positions' | 'orders' | 'history'>;

const draftOf = (s: Data): Draft =>
  structuredClone({
    usdt: s.usdt,
    spot: s.spot,
    futUsdt: s.futUsdt,
    positions: s.positions,
    orders: s.orders,
    history: s.history,
  });

function log(d: Draft, t: Omit<Trade, 'id' | 't'>) {
  d.history.unshift({ id: uid(), t: Date.now(), ...t });
  if (d.history.length > 300) d.history.length = 300;
}

function spotBuyFill(d: Draft, sym: string, qty: number, price: number, paid: number) {
  const h = d.spot[sym] ?? { qty: 0, cost: 0 };
  d.spot[sym] = { qty: h.qty + qty, cost: h.cost + paid };
  log(d, { kind: 'spot', sym, label: 'Купівля', good: true, price, qty });
}

function spotSellFill(d: Draft, sym: string, qty: number, price: number, cost: number) {
  const got = qty * price * (1 - FEE_SPOT);
  d.usdt += got;
  log(d, { kind: 'spot', sym, label: 'Продаж', good: false, price, qty, pnl: got - cost });
}

/** Забирає монети зі спот-балансу, повертає їх собівартість */
function takeCoins(d: Draft, sym: string, qty: number) {
  const h = d.spot[sym];
  const part = Math.min(1, qty / h.qty);
  const cost = h.cost * part;
  const left = h.qty - qty;
  if (left <= h.qty * 1e-9) delete d.spot[sym];
  else d.spot[sym] = { qty: left, cost: h.cost - cost };
  return cost;
}

function openPos(
  d: Draft,
  a: { sym: string; side: 'long' | 'short'; qty: number; price: number; margin: number; lev: number; tp?: number; sl?: number },
) {
  const ex = d.positions.find((x) => x.sym === a.sym && x.side === a.side);
  if (ex) {
    const qty = ex.qty + a.qty;
    ex.entry = (ex.entry * ex.qty + a.price * a.qty) / qty;
    ex.qty = qty;
    ex.margin += a.margin;
    ex.lev = Math.max(1, Math.round((ex.entry * qty) / ex.margin));
    if (a.tp) ex.tp = a.tp;
    if (a.sl) ex.sl = a.sl;
  } else {
    d.positions.unshift({
      id: uid(),
      sym: a.sym,
      side: a.side,
      qty: a.qty,
      entry: a.price,
      margin: a.margin,
      lev: a.lev,
      tp: a.tp,
      sl: a.sl,
      t: Date.now(),
    });
  }
  log(d, {
    kind: 'fut',
    sym: a.sym,
    label: (a.side === 'long' ? 'Лонг' : 'Шорт') + ' ' + a.lev + 'x',
    good: a.side === 'long',
    price: a.price,
    qty: a.qty,
  });
}

function closePos(d: Draft, id: string, frac: number, price: number, why: string) {
  const i = d.positions.findIndex((x) => x.id === id);
  if (i < 0) return 0;
  const pos = d.positions[i];
  const f = Math.min(1, Math.max(0, frac));
  const q = pos.qty * f;
  const m = pos.margin * f;
  const fee = q * price * FEE_FUT;
  const pnl = (pos.side === 'long' ? price - pos.entry : pos.entry - price) * q;
  const back = Math.max(0, m + pnl - fee);
  d.futUsdt += back;
  if (f >= 1 - 1e-9) d.positions.splice(i, 1);
  else {
    pos.qty -= q;
    pos.margin -= m;
  }
  const net = back - m;
  log(d, { kind: 'fut', sym: pos.sym, label: why, good: net >= 0, price, qty: q, pnl: net });
  return net;
}

function tpSlError(side: 'long' | 'short', ref: number, tp?: number, sl?: number): string | null {
  if (side === 'long') {
    if (tp && tp <= ref) return 'Тейк-профіт для лонга має бути вище ціни';
    if (sl && sl >= ref) return 'Стоп-лосс для лонга має бути нижче ціни';
  } else {
    if (tp && tp >= ref) return 'Тейк-профіт для шорта має бути нижче ціни';
    if (sl && sl <= ref) return 'Стоп-лосс для шорта має бути вище ціни';
  }
  return null;
}

/* ---------- сховище ---------- */
const capStorage: StateStorage = {
  getItem: async (k) => (await Preferences.get({ key: k })).value,
  setItem: async (k, v) => {
    await Preferences.set({ key: k, value: v });
  },
  removeItem: async (k) => {
    await Preferences.remove({ key: k });
  },
};

export const useAccount = create<Account>()(
  persist(
    (set, get) => ({
      ...fresh(),

      spotOrder({ sym, side, qty, limit }) {
        const cur = priceOf(sym);
        if (!(qty > 0)) return 'Введи кількість';
        if (!(cur > 0)) return 'Немає ціни';
        const s = get();
        const d = draftOf(s);
        if (side === 'buy') {
          const isLimit = !!limit && limit < cur;
          const price = isLimit ? limit! : cur;
          const paid = qty * price * (1 + FEE_SPOT);
          if (qty * price < 1) return 'Мінімальна сума - 1 USDT';
          if (paid > d.usdt + 1e-6) return 'Недостатньо USDT';
          const pay = Math.min(paid, d.usdt);
          d.usdt -= pay;
          if (isLimit) {
            d.orders.unshift({ id: uid(), kind: 'spot', sym, side, price, qty, locked: pay, t: Date.now() });
          } else spotBuyFill(d, sym, qty, price, pay);
        } else {
          const h = d.spot[sym];
          if (!h || qty > h.qty * (1 + 1e-9)) return 'Недостатньо ' + sym;
          const q = Math.min(qty, h.qty);
          const isLimit = !!limit && limit > cur;
          const price = isLimit ? limit! : cur;
          if (q * price < 1) return 'Мінімальна сума - 1 USDT';
          const cost = takeCoins(d, sym, q);
          if (isLimit) {
            d.orders.unshift({ id: uid(), kind: 'spot', sym, side, price, qty: q, locked: cost, t: Date.now() });
          } else spotSellFill(d, sym, q, price, cost);
        }
        set(d);
        return null;
      },

      futOrder({ sym, side, margin, lev, limit, tp, sl }) {
        const cur = priceOf(sym);
        if (!(margin > 0)) return 'Введи суму маржі';
        if (margin < 1) return 'Мінімальна маржа - 1 USDT';
        if (!(cur > 0)) return 'Немає ціни';
        lev = Math.min(MAX_LEV, Math.max(1, Math.round(lev)));
        const isLimit = !!limit && (side === 'long' ? limit < cur : limit > cur);
        const price = isLimit ? limit! : cur;
        const e = tpSlError(side, price, tp, sl);
        if (e) return e;
        const s = get();
        const d = draftOf(s);
        const notional = margin * lev;
        const fee = notional * FEE_FUT;
        if (margin + fee > d.futUsdt + 1e-6) return 'Недостатньо USDT на ф’ючерсному гаманці';
        const qty = notional / price;
        const pay = Math.min(margin + fee, d.futUsdt);
        d.futUsdt -= pay;
        if (isLimit) {
          d.orders.unshift({ id: uid(), kind: 'fut', sym, side, price, qty, locked: pay, lev, margin, tp, sl, t: Date.now() });
        } else openPos(d, { sym, side, qty, price, margin, lev, tp, sl });
        set(d);
        return null;
      },

      closePosition(id, frac) {
        const s = get();
        const pos = s.positions.find((x) => x.id === id);
        if (!pos) return;
        const d = draftOf(s);
        const net = closePos(d, id, frac, priceOf(pos.sym), 'Закриття ' + (pos.side === 'long' ? 'лонга' : 'шорта'));
        set(d);
        toast(`Позицію закрито: ${net >= 0 ? '+' : ''}${net.toFixed(2)} USDT`, net >= 0 ? 'ok' : 'bad');
      },

      setTpSl(id, tp, sl) {
        const s = get();
        const pos = s.positions.find((x) => x.id === id);
        if (!pos) return null;
        const e = tpSlError(pos.side, priceOf(pos.sym), tp, sl);
        if (e) return e;
        set({ positions: s.positions.map((x) => (x.id === id ? { ...x, tp: tp || undefined, sl: sl || undefined } : x)) });
        return null;
      },

      cancelOrder(id) {
        const s = get();
        const o = s.orders.find((x) => x.id === id);
        if (!o) return;
        const d = draftOf(s);
        d.orders = d.orders.filter((x) => x.id !== id);
        if (o.kind === 'fut') d.futUsdt += o.locked;
        else if (o.side === 'buy') d.usdt += o.locked;
        else {
          const h = d.spot[o.sym] ?? { qty: 0, cost: 0 };
          d.spot[o.sym] = { qty: h.qty + o.qty, cost: h.cost + o.locked };
        }
        set(d);
      },

      transfer(to, amount) {
        const s = get();
        if (!(amount > 0)) return 'Введи суму';
        if (to === 'fut') {
          if (amount > s.usdt + 1e-6) return 'Недостатньо USDT на споті';
          const a = Math.min(amount, s.usdt);
          set({ usdt: s.usdt - a, futUsdt: s.futUsdt + a });
        } else {
          if (amount > s.futUsdt + 1e-6) return 'Недостатньо USDT на ф’ючерсах';
          const a = Math.min(amount, s.futUsdt);
          set({ usdt: s.usdt + a, futUsdt: s.futUsdt - a });
        }
        return null;
      },

      toggleFav(sym) {
        const f = get().favs;
        set({ favs: f.includes(sym) ? f.filter((x) => x !== sym) : [...f, sym] });
      },

      setForceSim(v) {
        set({ forceSim: v });
      },

      reset() {
        set({ ...fresh(), favs: get().favs, forceSim: get().forceSim });
      },

      importData(json) {
        try {
          const o = JSON.parse(json);
          if (typeof o.usdt !== 'number' || typeof o.spot !== 'object' || !Array.isArray(o.positions))
            return 'Це не схоже на резервну копію DemoTrade';
          const base = fresh();
          set({
            usdt: o.usdt,
            spot: o.spot ?? {},
            futUsdt: typeof o.futUsdt === 'number' ? o.futUsdt : 0,
            positions: o.positions,
            orders: Array.isArray(o.orders) ? o.orders : [],
            history: Array.isArray(o.history) ? o.history : [],
            equity: Array.isArray(o.equity) && o.equity.length ? o.equity : base.equity,
            favs: Array.isArray(o.favs) ? o.favs : base.favs,
          });
          return null;
        } catch {
          return 'Не вдалося прочитати дані';
        }
      },

      /** Викликається на кожне оновлення цін: виконує ліміти, TP/SL, ліквідації */
      tick(p) {
        const s = get();
        let need = false;
        for (const o of s.orders) {
          const c = p[o.sym]?.price;
          if (!c) continue;
          if (o.side === 'buy' || o.side === 'long' ? c <= o.price : c >= o.price) {
            need = true;
            break;
          }
        }
        if (!need)
          for (const pos of s.positions) {
            const c = p[pos.sym]?.price;
            if (!c) continue;
            const liq = liqPrice(pos);
            const L = pos.side === 'long';
            if ((L ? c <= liq : c >= liq) || (pos.tp && (L ? c >= pos.tp : c <= pos.tp)) || (pos.sl && (L ? c <= pos.sl : c >= pos.sl))) {
              need = true;
              break;
            }
          }

        const patch: Partial<Data> = {};
        if (need) {
          const d = draftOf(s);
          // 1) лімітні ордери
          for (const o of [...d.orders]) {
            const c = p[o.sym]?.price;
            if (!c) continue;
            const hit = o.side === 'buy' || o.side === 'long' ? c <= o.price : c >= o.price;
            if (!hit) continue;
            d.orders = d.orders.filter((x) => x.id !== o.id);
            if (o.kind === 'spot') {
              if (o.side === 'buy') spotBuyFill(d, o.sym, o.qty, o.price, o.locked);
              else spotSellFill(d, o.sym, o.qty, o.price, o.locked);
            } else {
              openPos(d, {
                sym: o.sym,
                side: o.side as 'long' | 'short',
                qty: o.qty,
                price: o.price,
                margin: o.margin!,
                lev: o.lev!,
                tp: o.tp,
                sl: o.sl,
              });
            }
            toast(`Лімітний ордер ${o.sym} виконано`, 'ok');
          }
          // 2) позиції
          for (const pos of [...d.positions]) {
            const c = p[pos.sym]?.price;
            if (!c) continue;
            const L = pos.side === 'long';
            const liq = liqPrice(pos);
            if (L ? c <= liq : c >= liq) {
              d.positions = d.positions.filter((x) => x.id !== pos.id);
              log(d, { kind: 'fut', sym: pos.sym, label: 'Ліквідація', good: false, price: liq, qty: pos.qty, pnl: -pos.margin });
              toast(`Позицію ${pos.sym} ліквідовано: -${pos.margin.toFixed(2)} USDT`, 'bad');
            } else if (pos.tp && (L ? c >= pos.tp : c <= pos.tp)) {
              const net = closePos(d, pos.id, 1, c, 'Тейк-профіт');
              toast(`Тейк-профіт ${pos.sym}: +${net.toFixed(2)} USDT`, 'ok');
            } else if (pos.sl && (L ? c <= pos.sl : c >= pos.sl)) {
              const net = closePos(d, pos.id, 1, c, 'Стоп-лосс');
              toast(`Стоп-лосс ${pos.sym}: ${net.toFixed(2)} USDT`, 'bad');
            }
          }
          Object.assign(patch, d);
        }

        // графік балансу: точка раз на хвилину
        const last = s.equity[s.equity.length - 1];
        const now = Date.now();
        if (!last || now - last.t >= 60000) {
          const v = totalEquity({ ...s, ...patch } as Data, p);
          const eq = [...s.equity, { t: now, v }];
          if (eq.length > 720) eq.splice(0, eq.length - 720);
          patch.equity = eq;
        }
        if (Object.keys(patch).length) set(patch);
      },
    }),
    {
      name: 'demotrade_account_v1',
      storage: createJSONStorage(() => capStorage),
      partialize: (s) => ({
        usdt: s.usdt,
        spot: s.spot,
        futUsdt: s.futUsdt,
        positions: s.positions,
        orders: s.orders,
        history: s.history,
        equity: s.equity,
        favs: s.favs,
        forceSim: s.forceSim,
      }),
    },
  ),
);

export const exportData = () => {
  const s = useAccount.getState();
  return JSON.stringify({
    usdt: s.usdt,
    spot: s.spot,
    futUsdt: s.futUsdt,
    positions: s.positions,
    orders: s.orders,
    history: s.history,
    equity: s.equity,
    favs: s.favs,
  });
};

/* ---------- навігація ---------- */
export type Tab = 'home' | 'markets' | 'spot' | 'fut' | 'wallet';
export const useUI = create<{ tab: Tab; sym: string; go(tab: Tab, sym?: string): void }>((set) => ({
  tab: 'home',
  sym: 'BTC',
  go: (tab, sym) => set((s) => ({ tab, sym: sym ?? s.sym })),
}));
