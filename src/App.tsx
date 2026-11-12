import { useEffect, useRef, useState } from 'react';
import { useAccount, useUI, type Tab } from './store';
import { startEngine, onTick, setForceSim } from './prices';
import { Toast } from './components/ui';
import { AutoInstallHint } from './components/Install';
import Home from './screens/Home';
import Markets from './screens/Markets';
import Trade from './screens/Trade';
import Wallet from './screens/Wallet';

const ICONS: Record<Tab, string> = {
  home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  markets: 'M4 20V10m5.3 10V4m5.4 16v-7M20 20V8',
  spot: 'M7 4v4m0 8v4M5 8h4v8H5zM17 3v3m0 9v6M15 6h4v9h-4z',
  fut: 'M13 2 4 14h7l-1 8 9-12h-7z',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zm13 6.5h2',
};
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Головна' },
  { id: 'markets', label: 'Ринки' },
  { id: 'spot', label: 'Спот' },
  { id: 'fut', label: 'Ф’ючерси' },
  { id: 'wallet', label: 'Активи' },
];

export default function App() {
  const [ready, setReady] = useState(useAccount.persist.hasHydrated());
  const tab = useUI((s) => s.tab);
  const sym = useUI((s) => s.sym);
  const go = useUI((s) => s.go);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready) return;
    return useAccount.persist.onFinishHydration(() => setReady(true));
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    setForceSim(useAccount.getState().forceSim);
    startEngine();
    return onTick((p) => useAccount.getState().tick(p)) as () => void;
  }, [ready]);

  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
  }, [tab, sym]);

  if (!ready)
    return (
      <div className="splash">
        <span className="logo-mark big">D</span>
      </div>
    );

  return (
    <div className="app">
      <div className="content" ref={scroller}>
        {tab === 'home' && <Home />}
        {tab === 'markets' && <Markets />}
        {tab === 'spot' && <Trade mode="spot" />}
        {tab === 'fut' && <Trade mode="fut" />}
        {tab === 'wallet' && <Wallet />}
      </div>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICONS[t.id]} />
            </svg>
            {t.label}
          </button>
        ))}
      </nav>
      <AutoInstallHint />
      <Toast />
    </div>
  );
}
