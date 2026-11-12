/** Кількість знаків після коми для ціни */
export const dp = (p: number) => (p >= 100 ? 2 : p >= 1 ? 3 : p >= 0.1 ? 4 : p >= 0.001 ? 6 : 8);

export const fmtPrice = (p: number) => {
  const d = dp(p);
  return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

export const fmtUsd = (v: number, d = 2) =>
  v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtQty = (q: number) => {
  const a = Math.abs(q);
  const d = a >= 1000 ? 2 : a >= 1 ? 4 : 6;
  return q.toLocaleString('en-US', { maximumFractionDigits: d });
};

export const fmtCompact = (v: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v);

export const fmtPct = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

export const sign = (v: number) => (v >= 0 ? '+' : '-');

/** Розбір числа з поля вводу (кома або крапка) */
export const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(v) ? v : 0;
};

/** Число -> рядок для поля вводу без зайвих нулів */
export const toInput = (v: number, d = 8) => {
  if (!Number.isFinite(v) || v <= 0) return '';
  return String(parseFloat(v.toFixed(d)));
};

export const fmtTime = (t: number) => {
  const d = new Date(t);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(d.getDate())}.${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}`;
};
