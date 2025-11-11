// Service Worker for LJean Centralized
// Handles push notifications and offline support

const CACHE_NAME = 'ljean-cache-v1';
const urlsToCache = [
  '/',
  '/index.html'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[Service Worker] Install failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  let notificationData = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: 'default',
    requireInteraction: false,
    data: {}
  };

  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (error) {
      console.error('[Service Worker] Error parsing push data:', error);
      try {
        notificationData.body = event.data.text();
      } catch (textError) {
        console.error('[Service Worker] Error reading push text:', textError);
      }
    }
  }

  const { title, body, icon, badge, tag, data, requireInteraction, vibrate } = notificationData;

  const options = {
    body: body || 'You have a new notification',
    icon: icon || '/vite.svg',
    badge: badge || '/vite.svg',
    tag: tag || 'default',
    data: data || {},
    requireInteraction: requireInteraction || false,
    vibrate: vibrate || [200, 100, 200],
    // Mobile-friendly options
    actions: [],
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification(title || 'New Notification', options)
      .catch((error) => {
        console.error('[Service Worker] Show notification error:', error);
      })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if none found
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .catch((error) => {
        console.error('[Service Worker] Notification click error:', error);
      })
  );
});

// Handle service worker errors
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});
