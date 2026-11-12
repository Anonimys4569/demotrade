// Service worker: зберігає файли додатка на пристрої, щоб він відкривався без інтернету
const CACHE = 'demotrade-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // ціни з Binance не кешуємо

  const put = (res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };

  if (req.mode === 'navigate') {
    // сторінка: спочатку мережа (щоб приходили оновлення), без мережі - з кешу
    e.respondWith(
      fetch(req)
        .then(put)
        .catch(() => caches.match(req, { ignoreVary: true }).then((r) => r || caches.match('./index.html', { ignoreVary: true }))),
    );
    return;
  }
  // решта файлів: з кешу, якщо є
  e.respondWith(caches.match(req, { ignoreVary: true }).then((r) => r || fetch(req).then(put)));
});
