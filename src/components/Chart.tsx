import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, ColorType, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { loadCandles, pushTick, usePrices, priceOf, type Candle } from '../prices';
import { dp } from '../format';

const tz = -new Date().getTimezoneOffset() * 60;
const conv = (c: Candle) => ({ time: (c.time + tz) as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close });

export default function Chart({ sym, iv }: { sym: string; iv: string }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const live = usePrices((s) => s.live);

  useEffect(() => {
    const c = createChart(box.current!, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#7d8696', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: { mode: 0 },
      handleScale: { axisPressedMouseMove: false },
    });
    series.current = c.addSeries(CandlestickSeries, {
      upColor: '#16c784',
      downColor: '#f6465d',
      wickUpColor: '#16c784',
      wickDownColor: '#f6465d',
      borderVisible: false,
    });
    chart.current = c;
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
    };
  }, []);

  useEffect(() => {
    let dead = false;
    let ready = false;
    const d = dp(priceOf(sym));
    series.current?.applyOptions({ priceFormat: { type: 'price', precision: d, minMove: 1 / 10 ** d } });
    loadCandles(sym, iv).then((arr) => {
      if (dead || !series.current) return;
      series.current.setData(arr.map(conv));
      chart.current?.timeScale().scrollToRealTime();
      ready = true;
    });
    const unsub = usePrices.subscribe((s) => {
      if (!ready || !series.current) return;
      const c = pushTick(sym, iv, s.p[sym].price);
      if (c) {
        try {
          series.current.update(conv(c));
        } catch {
          /* ignore */
        }
      }
    });
    return () => {
      dead = true;
      unsub();
    };
  }, [sym, iv, live]);

  return <div className="chart" ref={box} />;
}
