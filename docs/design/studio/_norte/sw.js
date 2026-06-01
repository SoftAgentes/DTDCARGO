/* DTD-Cargo · Portal Cliente · Service Worker
   App-shell cache para uso offline + instalación como PWA. */
const CACHE = 'dtd-portal-cliente-v3';

const APP_SHELL = [
  'Portal Cliente Mobile.html',
  'manifest.webmanifest',
  'erp/tokens.css',
  'erp/icons.jsx',
  'erp/data.jsx',
  'erp/components.jsx',
  'portal/mobile-extra.jsx',
  'portal/mobile.jsx',
  'assets/dtdcargo-isologo-reverse.png',
  'assets/pwa-icon-192.png',
  'assets/pwa-icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Network-first: siempre intenta la versión fresca (online) y guarda copia;
// si no hay red, sirve del cache (offline). Evita servir JSX/HTML viejos.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(
    fetch(request).then((res) => {
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(request))
  );
});
