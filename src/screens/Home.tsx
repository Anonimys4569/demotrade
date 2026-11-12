import { useState } from 'react';
import { useAccount, useUI, totalEquity, START_BALANCE } from '../store';
import { usePrices, changeOf } from '../prices';
import { COINS, COIN } from '../coins';
import { fmtPrice, fmtUsd, fmtPct } from '../format';
import { CoinIcon, LiveBadge, Pct, Spark } from '../components/ui';
import { TransferSheet } from '../components/lists';

export default function Home() {
  const acc = useAccount();
  const p = usePrices((s) => s.p);
  const go = useUI((s) => s.go);
  const [transfer, setTransfer] = useState(false);

  const eq = totalEquity(acc, p);
  const pnl = eq - START_BALANCE;
  const pnlPct = (pnl / START_BALANCE) * 100;
  const series = [...acc.equity.map((e) => e.v), eq];

  const sorted = [...COINS].sort((a, b) => changeOf(p[b.sym]) - changeOf(p[a.sym]));
  const movers = [...sorted.slice(0, 4), ...sorted.slice(-3).reverse()];
  const favs = acc.favs.filter((s) => COIN[s]);

  return (
    <div className="screen">
      <div className="topbar">
        <div className="logo">
          <span className="logo-mark">D</span>
          <b>DemoTrade</b>
        </div>
        <span className="grow" />
        <LiveBadge />
      </div>

      <div className="hero">
        <span className="hero-label">Загальний баланс · демо</span>
        <div className="hero-sum">
          <small>$</small>
          {fmtUsd(eq)}
        </div>
        <div className={'hero-pnl ' + (pnl >= 0 ? 'up' : 'down')}>
          {pnl >= 0 ? '+' : '-'}${fmtUsd(Math.abs(pnl))} ({fmtPct(pnlPct)}) <span>за весь час</span>
        </div>
        <div className="hero-chart">
          <Spark data={series} w={320} h={70} />
        </div>
      </div>

      <div className="actions">
        <button onClick={() => go('spot')}>
          <i className="a1">↗</i>
          Купити
        </button>
        <button onClick={() => go('fut')}>
          <i className="a2">⚡</i>
          Ф’ючерси
        </button>
        <button onClick={() => setTransfer(true)}>
          <i className="a3">⇄</i>
          Переказ
        </button>
        <button onClick={() => go('markets')}>
          <i className="a4">☰</i>
          Ринки
        </button>
      </div>

      <h3>Лідери руху</h3>
      <div className="movers">
        {movers.map((c) => {
          const t = p[c.sym];
          return (
            <button key={c.sym} className="mover" onClick={() => go('spot', c.sym)}>
              <div className="mover-top">
                <CoinIcon sym={c.sym} size={26} />
                <b>{c.sym}</b>
              </div>
              <div className="mover-price">{fmtPrice(t.price)}</div>
              <Pct v={changeOf(t)} pill />
            </button>
          );
        })}
      </div>

      <h3>Обрані</h3>
      <div className="list">
        {favs.length === 0 && <div className="empty">Додай монети в обрані зірочкою ☆</div>}
        {favs.map((sym) => {
          const t = p[sym];
          return (
            <button className="row" key={sym} onClick={() => go('spot', sym)}>
              <CoinIcon sym={sym} />
              <span className="row-main">
                <b>
                  {sym}
                  <small>/USDT</small>
                </b>
                <span className="muted">{COIN[sym].name}</span>
              </span>
              <span className="row-end">
                <b>{fmtPrice(t.price)}</b>
                <Pct v={changeOf(t)} />
              </span>
            </button>
          );
        })}
      </div>

      {transfer && <TransferSheet onClose={() => setTransfer(false)} />}
    </div>
  );
}
