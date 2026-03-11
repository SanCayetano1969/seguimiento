// v3 - forzar actualizacion SW
const CACHE = 'sc-v3'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => clients.claim())
  )
})

self.addEventListener('push', function(event) {
  let title = 'CD San Cayetano'
  let body = 'Nueva notificacion'
  let url = '/'

  if (event.data) {
    try {
      const data = event.data.json()
      title = data.title || title
      body = data.body || body
      url = data.url || url
    } catch(e) {
      body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: url }
    })
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
