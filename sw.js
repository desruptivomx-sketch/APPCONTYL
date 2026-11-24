// Service worker: guarda la "cáscara" de la app para que abra rápido y funcione como app instalada.
// Los datos (Supabase) nunca se guardan aquí: siempre se piden en vivo.
const VERSION = "parrilla-v45";
const SHELL = [
  "./", "index.html", "styles.css", "app.js", "config.js", "lib/supabase.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/favicon-isologo-32.png", "icons/favicon-isologo-64.png", "icons/logo-color-texto.png", "icons/logo-color.png", "icons/simbolo-arena.png", "icons/logo-arena-texto.png", "icons/composicion.svg", "icons/composicion-motion.svg", "icons/motivo-flor.svg",
  "fonts/the-seasons-regular.woff2", "fonts/gotham-rounded-light.woff2", "fonts/georgia-praline-serif.woff2"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase, fuentes: directo a la red
  // Red primero (para que los cambios publicados lleguen de inmediato), caché si no hay conexión.
  // Siempre pide al servidor la versión más reciente (evita que el navegador muestre una copia de hace minutos)
  // (una navegación no se puede copiar con new Request, por eso se pide por URL)
  const fresh = fetch(req.url, { cache: "no-cache", credentials: "same-origin" });
  e.respondWith(
    fresh.then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("index.html")))
  );
});
