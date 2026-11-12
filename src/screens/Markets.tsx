import { useState } from 'react';
import { useAccount, useUI } from '../store';
import { usePrices, changeOf } from '../prices';
import { COINS } from '../coins';
import { fmtCompact, fmtPrice } from '../format';
import { CoinIcon, LiveBadge, Pct } from '../components/ui';

const FILTERS = ['Усі', 'Обрані', 'Ріст', 'Падіння', 'Обсяг'];

export default function Markets() {
  const p = usePrices((s) => s.p);
  const favs = useAccount((s) => s.favs);
  const toggleFav = useAccount((s) => s.toggleFav);
  const go = useUI((s) => s.go);
  const [q, setQ] = useState('');
  const [f, setF] = useState(0);

  let list = COINS.filter((c) => (c.sym + c.name).toLowerCase().includes(q.trim().toLowerCase()));
  if (f === 1) list = list.filter((c) => favs.includes(c.sym));
  if (f === 2) list = [...list].sort((a, b) => changeOf(p[b.sym]) - changeOf(p[a.sym]));
  if (f === 3) list = [...list].sort((a, b) => changeOf(p[a.sym]) - changeOf(p[b.sym]));
  if (f === 4) list = [...list].sort((a, b) => p[b.sym].vol - p[a.sym].vol);

  return (
    <div className="screen">
      <div className="topbar">
        <h2>Ринки</h2>
        <span className="grow" />
        <LiveBadge />
      </div>
      <input className="search" placeholder="Пошук монети" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {FILTERS.map((x, i) => (
          <button key={x} className={f === i ? 'on' : ''} onClick={() => setF(i)}>
            {x}
          </button>
        ))}
      </div>
      <div className="list-head">
        <span>Монета / Обсяг 24г</span>
        <span>Ціна</span>
        <span>24г</span>
      </div>
      <div className="list">
        {list.length === 0 && <div className="empty">Нічого не знайдено</div>}
        {list.map((c) => {
          const t = p[c.sym];
          const on = favs.includes(c.sym);
          return (
            <div className="row market" key={c.sym} onClick={() => go('spot', c.sym)} role="button">
              <button
                className={'star sm' + (on ? ' on' : '')}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFav(c.sym);
                }}
                aria-label="Обране"
              >
                {on ? '★' : '☆'}
              </button>
              <CoinIcon sym={c.sym} size={34} />
              <span className="row-main">
                <b>
                  {c.sym}
                  <small>/USDT</small>
                </b>
                <span className="muted">Обс. {fmtCompact(t.vol)}</span>
              </span>
              <b className="m-price">{fmtPrice(t.price)}</b>
              <Pct v={changeOf(t)} pill />
            </div>
          );
        })}
      </div>
    </div>
  );
}
