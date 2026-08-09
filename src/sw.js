import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch {}
  const title   = payload.title ?? 'SPX Command Center'
  const options = {
    body:     payload.body ?? '',
    icon:     '/icons/pwa-192x192.png',
    badge:    '/icons/pwa-64x64.png',
    tag:      payload.tag ?? 'spx-alert',
    renotify: true,
    data:     { url: payload.url ?? '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    })
  )
})
