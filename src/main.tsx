import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import App from './App';
import './styles.css';

if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  if (Capacitor.getPlatform() === 'android') StatusBar.setBackgroundColor({ color: '#0b0e11' }).catch(() => {});
}

// Веб-версія: зберігаємо файли додатка для роботи без інтернету
if (!Capacitor.isNativePlatform() && location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(async () => {
        // при першому відкритті файли завантажились ще до service worker - докладаємо їх у кеш вручну
        const urls = performance
          .getEntriesByType('resource')
          .map((r) => r.name)
          .filter((u) => u.startsWith(location.origin) && !u.endsWith('/sw.js'));
        const cache = await caches.open('demotrade-v2');
        await Promise.all([location.href, ...urls].map((u) => cache.add(u).catch(() => {})));
      })
      .catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(<App />);
