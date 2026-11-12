import { useEffect, type ReactNode } from 'react';
import { COIN, COINS } from '../coins';
import { usePrices, changeOf } from '../prices';
import { useToast } from '../store';
import { fmtPrice, fmtPct } from '../format';
import { useState } from 'react';

const ICONS = import.meta.glob('../icons/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const iconOf = (sym: string) => ICONS[`../icons/${sym}.svg`];

export function CoinIcon({ sym, size = 36 }: { sym: string; size?: number }) {
  const c = COIN[sym];
  const color = c?.color ?? '#26a17b';
  const src = iconOf(sym);
  if (src) return <img className="coin" src={src} alt={sym} width={size} height={size} style={{ width: size, height: size }} draggable={false} />;
  return (
    <span
      className="coin"
      style={{
        width: size,
        height: size,
        fontSize: size * (sym.length > 3 ? 0.3 : 0.36),
        background: `linear-gradient(145deg, ${color}, ${color}99)`,
      }}
    >
      {sym === 'USDT' ? '₮' : sym.slice(0, 4)}
    </span>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <b>{title}</b>
          <button className="x" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast() {
  const { msg, kind, n } = useToast();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!n) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(t);
  }, [n]);
  if (!show) return null;
  return <div className={'toast ' + kind}>{msg}</div>;
}

export function Pct({ v, pill }: { v: number; pill?: boolean }) {
  return <span className={(pill ? 'pill ' : '') + (v >= 0 ? 'up' : 'down')}>{fmtPct(v)}</span>;
}

export function LiveBadge() {
  const live = usePrices((s) => s.live);
  return (
    <span className={'badge ' + (live ? 'live' : 'sim')} title={live ? 'Реальні ціни' : 'Симуляція цін'}>
      <i />
      {live ? 'LIVE' : 'СИМУЛЯЦІЯ'}
    </span>
  );
}

/** Маленький графік-лінія */
export function Spark({ data, w = 300, h = 64, color }: { data: number[]; w?: number; h?: number; color?: string }) {
  if (data.length < 2) data = [data[0] ?? 0, data[0] ?? 0];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 8)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const c = color ?? (data[data.length - 1] >= data[0] ? 'var(--green)' : 'var(--red)');
  const id = 'g' + Math.round(w * 7 + h);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="spark">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.35" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Вибір монети */
export function CoinPicker({ onPick, onClose }: { onPick(sym: string): void; onClose(): void }) {
  const p = usePrices((s) => s.p);
  const [q, setQ] = useState('');
  const list = COINS.filter((c) => (c.sym + c.name).toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet title="Вибери монету" onClose={onClose}>
      <input className="search" placeholder="Пошук" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="picker">
        {list.map((c) => (
          <button key={c.sym} className="row" onClick={() => onPick(c.sym)}>
            <CoinIcon sym={c.sym} size={32} />
            <span className="row-main">
              <b>
                {c.sym}
                <small>/USDT</small>
              </b>
              <span className="muted">{c.name}</span>
            </span>
            <span className="row-end">
              <b>{fmtPrice(p[c.sym].price)}</b>
              <Pct v={changeOf(p[c.sym])} />
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Поле вводу числа з підписом */
export function Field({
  label,
  unit,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange?(v: string): void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className={'field' + (disabled ? ' disabled' : '')}>
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? '0'}
        onChange={(e) => onChange?.(e.target.value.replace(/[^0-9.,]/g, ''))}
      />
      {unit && <em>{unit}</em>}
    </label>
  );
}
