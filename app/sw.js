/* Jot service worker: keeps the whole app on the device, so it opens offline and at once.
   Cache first; a new version installs in the background and waits until you reload. */

const VERSION = 'jot-v1.0.0'
const FILES = [
  './', 'index.html', 'app.js', 'db.js', 'icons.svg', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  '../css/paper.css', '../css/app.css', '../icon.svg', '../fonts/JetBrainsMono.woff2',
]

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))))
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k)
    await self.clients.claim()
  })())
})

self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting() })

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  e.respondWith((async () => {
    const cache = await caches.open(VERSION)
    if (req.mode === 'navigate' && url.pathname.startsWith(new URL('./', location).pathname)) {
      return (await cache.match('index.html')) || fetch(req)
    }
    return (await cache.match(req, { ignoreSearch: true })) || fetch(req)
  })())
})
