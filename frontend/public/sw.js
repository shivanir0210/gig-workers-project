self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'GigShield Alert';
  const options = {
    body: data.body || 'New parametric risk alert from GigShield',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: data.url || '/notifications'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(event.notification.data) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data);
      }
    })
  );
});
