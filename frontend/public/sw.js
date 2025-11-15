// Service Worker for LJean Centralized
// Handles push notifications and offline support
// Version: 2.1 - Updated notification icons to use LOGO.png

const CACHE_NAME = 'ljean-cache-v2';
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
  // Only handle same-origin GET requests to avoid interfering with API calls or third-party assets.
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache only successful responses so we can serve them offline later.
        const shouldCache = response.status === 200 && requestUrl.pathname.startsWith('/');
        if (shouldCache) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            })
            .catch((error) => {
              console.warn('[Service Worker] Failed to cache resource:', requestUrl.href, error);
            });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fall back to cached index.html for navigation requests so the SPA can bootstrap offline.
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            return Response.error();
          });
      })
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);
  console.log('[Service Worker] Push data available:', !!event.data);

  let notificationData = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/LOGO.png',
    badge: '/LOGO.png',
    tag: 'default',
    requireInteraction: false,
    data: {}
  };

  if (event.data) {
    try {
      const parsedData = event.data.json();
      console.log('[Service Worker] Parsed notification data:', parsedData);
      notificationData = { ...notificationData, ...parsedData };
    } catch (error) {
      console.error('[Service Worker] Error parsing push data:', error);
      try {
        notificationData.body = event.data.text();
        console.log('[Service Worker] Using text fallback:', notificationData.body);
      } catch (textError) {
        console.error('[Service Worker] Error reading push text:', textError);
      }
    }
  } else {
    console.log('[Service Worker] No push data received, using defaults');
  }

  const { title, body, icon, badge, tag, data, requireInteraction, vibrate } = notificationData;

  console.log('[Service Worker] Notification data:', { title, body, icon, badge, tag });

  const options = {
    body: body || 'You have a new notification',
    icon: icon || '/LOGO.png',
    badge: badge || '/LOGO.png',
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
