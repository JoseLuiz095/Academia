const CACHE_NAME = 'impulso-shell-v1'
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/favicon.svg', '/manifest.webmanifest']))); self.skipWaiting() })
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))); self.clients.claim() })
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))))
})
self.addEventListener('notificationclick', (event) => { event.notification.close(); const target = event.notification.data?.url || '/'; event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => { const existing = clients.find((client) => 'focus' in client); if (existing) { existing.navigate(target); return existing.focus() } return self.clients.openWindow(target) })) })
