import { useState } from 'react';
import { useAccount, useUI, totalEquity, posPnl, exportData, toast, START_BALANCE } from '../store';
import { usePrices, setForceSim as engineForceSim } from '../prices';
import { fmtQty, fmtUsd, fmtPct } from '../format';
import { CoinIcon, Sheet } from '../components/ui';
import { HistoryList, TransferSheet } from '../components/lists';
import { InstallSheet, canInstall } from '../components/Install';

export default function Wallet() {
  const acc = useAccount();
  const p = usePrices((s) => s.p);
  const go = useUI((s) => s.go);
  const [transfer, setTransfer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [backup, setBackup] = useState(false);
  const [imp, setImp] = useState('');
  const [install, setInstall] = useState(false);

  const eq = totalEquity(acc, p);
  const pnl = eq - START_BALANCE;
  let spotVal = acc.usdt;
  for (const s in acc.spot) spotVal += acc.spot[s].qty * p[s].price;
  for (const o of acc.orders) if (o.kind === 'spot') spotVal += o.side === 'sell' ? o.qty * p[o.sym].price : o.locked;
  const futVal = eq - spotVal;
  const upnl = acc.positions.reduce((a, x) => a + posPnl(x, p[x.sym].price), 0);
  const syms = Object.keys(acc.spot).sort((a, b) => acc.spot[b].qty * p[b].price - acc.spot[a].qty * p[a].price);

  const copy = async () => {
    const txt = exportData();
    try {
      await navigator.clipboard.writeText(txt);
      toast('Скопійовано в буфер обміну', 'ok');
    } catch {
      setImp(txt);
      toast('Скопіюй текст із поля вручну');
    }
  };

  return (
    <div className="screen">
      <div className="topbar">
        <h2>Активи</h2>
      </div>

      <div className="hero slim">
        <span className="hero-label">Усього</span>
        <div className="hero-sum">
          <small>$</small>
          {fmtUsd(eq)}
        </div>
        <div className={'hero-pnl ' + (pnl >= 0 ? 'up' : 'down')}>
          {pnl >= 0 ? '+' : '-'}${fmtUsd(Math.abs(pnl))} ({fmtPct((pnl / START_BALANCE) * 100)})
        </div>
      </div>

      <div className="two wallets">
        <button className="card w" onClick={() => go('spot')}>
          <span className="muted">Спот</span>
          <b>${fmtUsd(spotVal)}</b>
          <span className="muted">Вільно {fmtUsd(acc.usdt)} USDT</span>
        </button>
        <button className="card w" onClick={() => go('fut')}>
          <span className="muted">Ф’ючерси</span>
          <b>${fmtUsd(futVal)}</b>
          <span className={upnl >= 0 ? 'up' : 'down'}>
            PnL {upnl >= 0 ? '+' : ''}
            {fmtUsd(upnl)}
          </span>
        </button>
      </div>
      <button className="btn primary block" onClick={() => setTransfer(true)}>
        ⇄ Переказ між гаманцями
      </button>

      <h3>Монети</h3>
      <div className="list">
        <div className="row">
          <CoinIcon sym="USDT" />
          <span className="row-main">
            <b>USDT</b>
            <span className="muted">Tether</span>
          </span>
          <span className="row-end">
            <b>{fmtUsd(acc.usdt)}</b>
            <span className="muted">${fmtUsd(acc.usdt)}</span>
          </span>
        </div>
        {syms.map((sym) => {
          const h = acc.spot[sym];
          const val = h.qty * p[sym].price;
          const d = val - h.cost;
          return (
            <button className="row" key={sym} onClick={() => go('spot', sym)}>
              <CoinIcon sym={sym} />
              <span className="row-main">
                <b>{sym}</b>
                <span className="muted">{fmtQty(h.qty)}</span>
              </span>
              <span className="row-end">
                <b>${fmtUsd(val)}</b>
                <span className={d >= 0 ? 'up' : 'down'}>
                  {d >= 0 ? '+' : ''}
                  {fmtUsd(d)} ({fmtPct(h.cost > 0 ? (d / h.cost) * 100 : 0)})
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <h3>Історія угод</h3>
      <HistoryList limit={30} />

      <h3>Налаштування</h3>
      <div className="card settings">
        <label className="set">
          <span>
            <b>Тільки симуляція</b>
            <span className="muted">Не брати реальні ціни навіть з інтернетом</span>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={acc.forceSim}
            onChange={(e) => {
              acc.setForceSim(e.target.checked);
              engineForceSim(e.target.checked);
            }}
          />
        </label>
        {canInstall() && (
          <button className="set" onClick={() => setInstall(true)}>
            <span>
              <b>Встановити на телефон</b>
              <span className="muted">Іконка на екрані, як у звичайного додатка</span>
            </span>
            <span className="muted">›</span>
          </button>
        )}
        <button className="set" onClick={() => setBackup(true)}>
          <span>
            <b>Резервна копія</b>
            <span className="muted">Зберегти або відновити прогрес</span>
          </span>
          <span className="muted">›</span>
        </button>
        <button className="set" onClick={() => setConfirm(true)}>
          <span>
            <b className="down">Скинути рахунок</b>
            <span className="muted">Почати заново з $10,000</span>
          </span>
          <span className="muted">›</span>
        </button>
      </div>
      <p className="foot">DemoTrade 1.0 · гроші віртуальні · графіки: TradingView Lightweight Charts</p>

      {transfer && <TransferSheet onClose={() => setTransfer(false)} />}
      {install && <InstallSheet onClose={() => setInstall(false)} />}

      {confirm && (
        <Sheet title="Скинути рахунок?" onClose={() => setConfirm(false)}>
          <p className="muted pad">Усі монети, позиції, ордери та історія зникнуть. Баланс знову стане $10,000.</p>
          <div className="two">
            <button className="btn ghost" onClick={() => setConfirm(false)}>
              Ні
            </button>
            <button
              className="btn red"
              onClick={() => {
                acc.reset();
                setConfirm(false);
                toast('Рахунок скинуто', 'ok');
              }}
            >
              Так, скинути
            </button>
          </div>
        </Sheet>
      )}

      {backup && (
        <Sheet title="Резервна копія" onClose={() => setBackup(false)}>
          <p className="muted pad">
            Скопіюй дані й збережи їх у нотатках. Щоб відновити прогрес (наприклад, після видалення додатка), встав цей текст
            у поле нижче.
          </p>
          <button className="btn primary block" onClick={copy}>
            Скопіювати мої дані
          </button>
          <textarea className="area" placeholder="Встав сюди збережені дані" value={imp} onChange={(e) => setImp(e.target.value)} />
          <button
            className="btn ghost block"
            onClick={() => {
              if (!imp.trim()) return toast('Спочатку встав дані', 'bad');
              const e = acc.importData(imp.trim());
              if (e) toast(e, 'bad');
              else {
                toast('Прогрес відновлено', 'ok');
                setImp('');
                setBackup(false);
              }
            }}
          >
            Відновити з тексту
          </button>
        </Sheet>
      )}
    </div>
  );
}
