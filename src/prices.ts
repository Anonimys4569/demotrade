import { create } from 'zustand';
import { COINS, COIN } from './coins';

/* ------------------------------------------------------------------
   Рушій цін.
   Є інтернет  -> реальні ціни з публічного API Binance (без свого сервера).
   Немає       -> реалістична симуляція від останньої відомої ціни.
------------------------------------------------------------------- */

export interface Tick {
  price: number;
  open: number; // ціна 24 год тому
  high: number;
  low: number;
  vol: number; // обсяг за 24 год в USDT
}

interface PriceState {
  p: Record<string, Tick>;
  live: boolean;
}

const LS_KEY = 'dt_prices_v1';

function initial(): Record<string, Tick> {
  let saved: Record<string, Tick> = {};
  try {
    saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    /* ignore */
  }
  const out: Record<string, Tick> = {};
  for (const c of COINS) {
    const s = saved[c.sym];
    out[c.sym] =
      s && s.price > 0
        ? s
        : { price: c.def, open: c.def * 0.99, high: c.def * 1.02, low: c.def * 0.97, vol: c.def * 1e6 };
  }
  return out;
}

export const usePrices = create<PriceState>(() => ({ p: initial(), live: false }));

export const priceOf = (sym: string) => usePrices.getState().p[sym]?.price ?? 0;
export const changeOf = (t: Tick) => (t.open > 0 ? ((t.price - t.open) / t.open) * 100 : 0);

type Listener = (prices: Record<string, Tick>) => void;
const listeners = new Set<Listener>();
export const onTick = (fn: Listener) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/* ---------------- службове ---------------- */

const REST = ['https://api.binance.com', 'https://data-api.binance.vision'];
const WSS = ['wss://stream.binance.com:9443', 'wss://data-stream.binance.vision'];

let pending: Record<string, Tick> = {};
let ws: WebSocket | null = null;
let wsHost = 0;
let lastMsg = 0;
let connecting = false;
let forceSim = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let lastSave = 0;

function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function flush() {
  const keys = Object.keys(pending);
  if (!keys.length) return;
  const p = { ...usePrices.getState().p, ...pending };
  pending = {};
  usePrices.setState({ p });
  listeners.forEach((fn) => fn(p));
  const now = Date.now();
  if (now - lastSave > 8000) {
    lastSave = now;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }
}

/* ---------------- симуляція ---------------- */

function simStep() {
  const cur = usePrices.getState().p;
  const market = gauss() * 0.00018; // спільний рух ринку
  for (const c of COINS) {
    const t = cur[c.sym];
    const r = market * (0.6 + c.vol * 0.4) + gauss() * 0.00028 * c.vol;
    // слабке повернення до ціни відкриття, щоб симуляція не "тікала" в нескінченність
    const pull = t.open > 0 ? -Math.log(t.price / t.open) * 0.00002 : 0;
    const price = t.price * Math.exp(r + pull);
    pending[c.sym] = {
      price,
      open: t.open,
      high: Math.max(t.high, price),
      low: Math.min(t.low, price),
      vol: t.vol * (1 + Math.random() * 0.00002),
    };
  }
}

/* ---------------- реальні ціни ---------------- */

async function fetchJson(path: string): Promise<any> {
  let err: unknown;
  for (const host of REST) {
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 7000);
      const r = await fetch(host + path, { signal: ctl.signal });
      clearTimeout(to);
      if (r.ok) return await r.json();
      err = new Error('HTTP ' + r.status);
    } catch (e) {
      err = e;
    }
  }
  throw err;
}

function setLive(v: boolean) {
  if (usePrices.getState().live !== v) usePrices.setState({ live: v });
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connect, 15000);
}

async function connect() {
  if (forceSim || ws || connecting) return;
  connecting = true;
  try {
    const syms = COINS.map((c) => c.sym + 'USDT');
    const data = await fetchJson('/api/v3/ticker/24hr?symbols=' + encodeURIComponent(JSON.stringify(syms)));
    for (const d of data as any[]) {
      const sym = String(d.symbol).replace(/USDT$/, '');
      if (!COIN[sym]) continue;
      const price = +d.lastPrice;
      if (!(price > 0)) continue;
      pending[sym] = { price, open: +d.openPrice, high: +d.highPrice, low: +d.lowPrice, vol: +d.quoteVolume };
    }
    if (forceSim) return;
    setLive(true);
    flush();
    openSocket();
  } catch {
    setLive(false);
    scheduleRetry();
  } finally {
    connecting = false;
  }
}

function openSocket() {
  const streams = COINS.map((c) => c.sym.toLowerCase() + 'usdt@miniTicker').join('/');
  let sock: WebSocket;
  try {
    sock = new WebSocket(WSS[wsHost % WSS.length] + '/stream?streams=' + streams);
  } catch {
    setLive(false);
    scheduleRetry();
    return;
  }
  ws = sock;
  lastMsg = Date.now();
  sock.onmessage = (ev) => {
    try {
      const d = JSON.parse(ev.data).data;
      const sym = String(d.s).replace(/USDT$/, '');
      if (!COIN[sym]) return;
      const price = +d.c;
      if (!(price > 0)) return;
      pending[sym] = { price, open: +d.o, high: +d.h, low: +d.l, vol: +d.q };
      lastMsg = Date.now();
    } catch {
      /* ignore */
    }
  };
  const down = () => {
    if (ws !== sock) return;
    ws = null;
    wsHost++;
    setLive(false);
    scheduleRetry();
  };
  sock.onclose = down;
  sock.onerror = () => {
    try {
      sock.close();
    } catch {
      /* ignore */
    }
    down();
  };
}

export function setForceSim(v: boolean) {
  forceSim = v;
  if (v) {
    clearTimeout(retryTimer);
    const s = ws;
    ws = null;
    try {
      s?.close();
    } catch {
      /* ignore */
    }
    setLive(false);
  } else {
    connect();
  }
}

let started = false;
export function startEngine() {
  if (started) return;
  started = true;
  setInterval(flush, 600);
  setInterval(() => {
    const live = usePrices.getState().live;
    if (!live) simStep();
    else if (ws && Date.now() - lastMsg > 12000) {
      // з'єднання "зависло" - перепідключаємось
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }, 1000);
  window.addEventListener('online', () => connect());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) connect();
  });
  connect();
}

/* ---------------- свічки ---------------- */

export interface Candle {
  time: number; // секунди
  open: number;
  high: number;
  low: number;
  close: number;
}

export const INTERVALS: { id: string; label: string; sec: number }[] = [
  { id: '1m', label: '1хв', sec: 60 },
  { id: '5m', label: '5хв', sec: 300 },
  { id: '15m', label: '15хв', sec: 900 },
  { id: '1h', label: '1г', sec: 3600 },
  { id: '4h', label: '4г', sec: 14400 },
  { id: '1d', label: '1д', sec: 86400 },
];
const IV_SEC: Record<string, number> = Object.fromEntries(INTERVALS.map((i) => [i.id, i.sec]));

const cache = new Map<string, Candle[]>();

function synth(sym: string, iv: string): Candle[] {
  const sec = IV_SEC[iv];
  const n = 300;
  const k = 0.00006 * Math.sqrt(sec) * COIN[sym].vol;
  const now = Math.floor(Date.now() / 1000 / sec) * sec;
  const out: Candle[] = new Array(n);
  let close = priceOf(sym);
  for (let i = n - 1; i >= 0; i--) {
    const open = close * Math.exp(-gauss() * k);
    const hi = Math.max(open, close) * (1 + Math.abs(gauss()) * k * 0.45);
    const lo = Math.min(open, close) * (1 - Math.abs(gauss()) * k * 0.45);
    out[i] = { time: now - (n - 1 - i) * sec, open, high: hi, low: lo, close };
    close = open;
  }
  return out;
}

export async function loadCandles(sym: string, iv: string): Promise<Candle[]> {
  const key = sym + '|' + iv;
  if (usePrices.getState().live) {
    try {
      const data = await fetchJson(`/api/v3/klines?symbol=${sym}USDT&interval=${iv}&limit=300`);
      const arr: Candle[] = (data as any[]).map((k) => ({
        time: Math.floor(k[0] / 1000),
        open: +k[1],
        high: +k[2],
        low: +k[3],
        close: +k[4],
      }));
      if (arr.length) {
        cache.set(key, arr);
        return arr;
      }
    } catch {
      /* падаємо в кеш/симуляцію */
    }
  }
  let arr = cache.get(key);
  if (!arr) {
    arr = synth(sym, iv);
    cache.set(key, arr);
  }
  return arr;
}

/** Оновлює останню свічку поточною ціною, повертає її */
export function pushTick(sym: string, iv: string, price: number): Candle | null {
  const arr = cache.get(sym + '|' + iv);
  if (!arr || !arr.length) return null;
  const sec = IV_SEC[iv];
  const bucket = Math.floor(Date.now() / 1000 / sec) * sec;
  let last = arr[arr.length - 1];
  if (bucket > last.time) {
    last = { time: bucket, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price };
    arr.push(last);
    if (arr.length > 600) arr.shift();
  } else {
    last.close = price;
    if (price > last.high) last.high = price;
    if (price < last.low) last.low = price;
  }
  return last;
}
