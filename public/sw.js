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

                        const options = {
                              body: body,
                              icon: '/icon-192.png',
                              badge: '/icon-192.png',
                              vibrate: [200, 100, 200],
                              data: { url: url },
                        }

                        event.waitUntil(
                              self.registration.showNotification(title, options)
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

self.addEventListener('install', e => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))
