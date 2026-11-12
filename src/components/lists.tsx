import { useState } from 'react';
import { useAccount, liqPrice, posPnl, toast, type Position } from '../store';
import { usePrices } from '../prices';
import { fmtPrice, fmtQty, fmtTime, fmtUsd, num, toInput } from '../format';
import { CoinIcon, Field, Sheet } from './ui';

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export function OrdersList({ kind }: { kind: 'spot' | 'fut' }) {
  const orders = useAccount((s) => s.orders).filter((o) => o.kind === kind);
  const cancel = useAccount((s) => s.cancelOrder);
  if (!orders.length) return <Empty text="Відкритих ордерів немає" />;
  return (
    <div className="list">
      {orders.map((o) => {
        const good = o.side === 'buy' || o.side === 'long';
        const name = { buy: 'Купівля', sell: 'Продаж', long: 'Лонг', short: 'Шорт' }[o.side];
        return (
          <div className="card order" key={o.id}>
            <CoinIcon sym={o.sym} size={30} />
            <div className="row-main">
              <b>
                {o.sym}/USDT{' '}
                <span className={'tag ' + (good ? 'up' : 'down')}>
                  Ліміт · {name}
                  {o.lev ? ` ${o.lev}x` : ''}
                </span>
              </b>
              <span className="muted">
                {fmtQty(o.qty)} {o.sym} по {fmtPrice(o.price)}
              </span>
            </div>
            <button className="btn ghost sm" onClick={() => cancel(o.id)}>
              Скасувати
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function HistoryList({ kind, limit = 40 }: { kind?: 'spot' | 'fut'; limit?: number }) {
  const all = useAccount((s) => s.history);
  const list = (kind ? all.filter((h) => h.kind === kind) : all).slice(0, limit);
  if (!list.length) return <Empty text="Історія порожня" />;
  return (
    <div className="list">
      {list.map((h) => (
        <div className="hist" key={h.id}>
          <div className="row-main">
            <b>
              <span className={h.good ? 'up' : 'down'}>{h.label}</span> {h.sym}
            </b>
            <span className="muted">
              {fmtQty(h.qty)} по {fmtPrice(h.price)} · {fmtTime(h.t)}
            </span>
          </div>
          {h.pnl !== undefined && (
            <b className={h.pnl >= 0 ? 'up' : 'down'}>
              {h.pnl >= 0 ? '+' : ''}
              {fmtUsd(h.pnl)}
            </b>
          )}
        </div>
      ))}
    </div>
  );
}

function PositionCard({ pos }: { pos: Position }) {
  const price = usePrices((s) => s.p[pos.sym].price);
  const close = useAccount((s) => s.closePosition);
  const setTpSl = useAccount((s) => s.setTpSl);
  const [edit, setEdit] = useState(false);
  const [tp, setTp] = useState(toInput(pos.tp ?? 0));
  const [sl, setSl] = useState(toInput(pos.sl ?? 0));
  const pnl = posPnl(pos, price);
  const roe = (pnl / pos.margin) * 100;
  const cls = pnl >= 0 ? 'up' : 'down';
  return (
    <div className="card pos">
      <div className="pos-head">
        <CoinIcon sym={pos.sym} size={30} />
        <div className="row-main">
          <b>{pos.sym}/USDT</b>
          <span className={'tag ' + (pos.side === 'long' ? 'up' : 'down')}>
            {pos.side === 'long' ? 'Лонг' : 'Шорт'} {pos.lev}x
          </span>
        </div>
        <div className="row-end">
          <b className={cls}>
            {pnl >= 0 ? '+' : ''}
            {fmtUsd(pnl)} USDT
          </b>
          <span className={cls}>
            {roe >= 0 ? '+' : ''}
            {roe.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="grid3">
        <div>
          <span>Розмір</span>
          <b>{fmtUsd(pos.qty * price)}</b>
        </div>
        <div>
          <span>Ціна входу</span>
          <b>{fmtPrice(pos.entry)}</b>
        </div>
        <div>
          <span>Поточна</span>
          <b>{fmtPrice(price)}</b>
        </div>
        <div>
          <span>Маржа</span>
          <b>{fmtUsd(pos.margin)}</b>
        </div>
        <div>
          <span>Ліквідація</span>
          <b className="warn">{fmtPrice(liqPrice(pos))}</b>
        </div>
        <div>
          <span>TP / SL</span>
          <b>
            {pos.tp ? fmtPrice(pos.tp) : '—'} / {pos.sl ? fmtPrice(pos.sl) : '—'}
          </b>
        </div>
      </div>
      <div className="pos-btns">
        <button className="btn ghost sm" onClick={() => setEdit(true)}>
          TP / SL
        </button>
        <button className="btn ghost sm" onClick={() => close(pos.id, 0.5)}>
          Закрити 50%
        </button>
        <button className="btn ghost sm strong" onClick={() => close(pos.id, 1)}>
          Закрити
        </button>
      </div>
      {edit && (
        <Sheet title={`TP / SL · ${pos.sym}`} onClose={() => setEdit(false)}>
          <p className="muted pad">
            Позиція закриється автоматично, коли ціна дійде до вказаного рівня. Залиш поле порожнім, щоб прибрати.
          </p>
          <Field label="Тейк-профіт" unit="USDT" value={tp} onChange={setTp} placeholder="—" />
          <Field label="Стоп-лосс" unit="USDT" value={sl} onChange={setSl} placeholder="—" />
          <button
            className="btn primary block"
            onClick={() => {
              const e = setTpSl(pos.id, num(tp) || undefined, num(sl) || undefined);
              if (e) toast(e, 'bad');
              else {
                toast('TP / SL збережено', 'ok');
                setEdit(false);
              }
            }}
          >
            Зберегти
          </button>
        </Sheet>
      )}
    </div>
  );
}

export function PositionsList() {
  const positions = useAccount((s) => s.positions);
  if (!positions.length) return <Empty text="Відкритих позицій немає" />;
  return (
    <div className="list">
      {positions.map((p) => (
        <PositionCard key={p.id} pos={p} />
      ))}
    </div>
  );
}

export function TransferSheet({ onClose, initial = 'fut' }: { onClose(): void; initial?: 'fut' | 'spot' }) {
  const usdt = useAccount((s) => s.usdt);
  const futUsdt = useAccount((s) => s.futUsdt);
  const transfer = useAccount((s) => s.transfer);
  const [to, setTo] = useState<'fut' | 'spot'>(initial);
  const [amt, setAmt] = useState('');
  const [all, setAll] = useState(false);
  const avail = to === 'fut' ? usdt : futUsdt;
  return (
    <Sheet title="Переказ USDT" onClose={onClose}>
      <div className="transfer">
        <div>
          <span className="muted">Звідки</span>
          <b>{to === 'fut' ? 'Спот' : 'Ф’ючерси'}</b>
        </div>
        <button
          className="swap"
          onClick={() => {
            setTo(to === 'fut' ? 'spot' : 'fut');
            setAmt('');
            setAll(false);
          }}
          aria-label="Змінити напрямок"
        >
          ⇄
        </button>
        <div>
          <span className="muted">Куди</span>
          <b>{to === 'fut' ? 'Ф’ючерси' : 'Спот'}</b>
        </div>
      </div>
      <Field
        label="Сума"
        unit="USDT"
        value={amt}
        onChange={(v) => {
          setAmt(v);
          setAll(false);
        }}
      />
      <div className="avail">
        <span>Доступно: {fmtUsd(avail)} USDT</span>
        <button
          className="link"
          onClick={() => {
            setAmt(toInput(Math.floor(avail * 100) / 100, 2));
            setAll(true);
          }}
        >
          Усе
        </button>
      </div>
      <button
        className="btn primary block"
        onClick={() => {
          const e = transfer(to, all ? avail : num(amt));
          if (e) toast(e, 'bad');
          else {
            toast('Переказ виконано', 'ok');
            onClose();
          }
        }}
      >
        Переказати
      </button>
    </Sheet>
  );
}
