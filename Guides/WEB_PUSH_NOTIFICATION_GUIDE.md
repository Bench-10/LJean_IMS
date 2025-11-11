# Web Push Notification Implementation Guide

## Overview
This guide covers the complete implementation of web push notifications for the LJean Centralized system. Push notifications work alongside the existing WebSocket notifications and user notification system.

---

## Table of Contents
1. [Backend Setup](#backend-setup)
2. [Database Migration](#database-migration)
3. [Frontend Implementation](#frontend-implementation)
4. [Testing](#testing)
5. [Deployment](#deployment)
6. [Troubleshooting](#troubleshooting)

---

## Backend Setup

### 1. Install Dependencies
The `web-push` library has been installed:
```bash
npm install web-push
```

### 2. Generate VAPID Keys
VAPID keys are required for push notifications. Generate them once:

```bash
npx web-push generate-vapid-keys
```

This will output:
```
=======================================
Public Key:
<YOUR_PUBLIC_KEY>

Private Key:
<YOUR_PRIVATE_KEY>
=======================================
```

### 3. Environment Configuration
Add these to your `.env` file:

```env
# Web Push Notification Configuration
VAPID_PUBLIC_KEY=<YOUR_PUBLIC_KEY_FROM_STEP_2>
VAPID_PRIVATE_KEY=<YOUR_PRIVATE_KEY_FROM_STEP_2>
VAPID_SUBJECT=mailto:admin@ljean.com
```

⚠️ **IMPORTANT**: Keep your private key secret! Never commit it to version control.

---

## Database Migration

### Run the Migration
Execute the migration file to create the push subscriptions table:

```sql
-- File: migrations/step16_create_push_subscriptions.sql
-- Run this in your PostgreSQL database
\i migrations/step16_create_push_subscriptions.sql
```

Or using psql command line:
```bash
psql -U your_username -d your_database -f migrations/step16_create_push_subscriptions.sql
```

### Table Structure
The `push_subscriptions` table stores:
- User/Admin subscription information
- Push endpoint and encryption keys
- Device information
- Active/inactive status
- Usage timestamps

---

## Backend Components

### 1. Service Layer (`backend/Services/pushNotificationService.js`)

**Key Functions:**

- `subscribeToPush(subscriptionData)` - Register new push subscription
- `unsubscribeFromPush(endpoint)` - Deactivate subscription
- `getUserSubscriptions(userId, adminId, userType)` - Get user's active subscriptions
- `sendPushNotification(params)` - Send push to specific user
- `sendAlertPushNotification(alert)` - Send push for inventory alerts
- `getVapidPublicKey()` - Get public key for client
- `cleanupInactiveSubscriptions(daysInactive)` - Remove old subscriptions

### 2. Controller Layer (`backend/Controllers/pushNotificationController.js`)

**API Endpoints:**

- `POST /api/push/subscribe` - Subscribe to push notifications
- `POST /api/push/unsubscribe` - Unsubscribe from push notifications
- `GET /api/push/subscriptions` - Get user's subscriptions
- `POST /api/push/test` - Send test notification
- `GET /api/push/vapid-public-key` - Get VAPID public key (public route)
- `POST /api/push/cleanup` - Cleanup inactive subscriptions (admin only)

### 3. Routes (`backend/Routes/pushNotificationRoutes.js`)

All routes are prefixed with `/api/push/` and require authentication except `vapid-public-key`.

### 4. Integration with Existing Notifications

The system now sends push notifications automatically when:
- Low stock alerts are created
- Product validity alerts are triggered
- User approval requests are made
- Inventory approval requests are made
- Delivery notifications are sent
- Sales alerts are generated

---

## Frontend Implementation

### 1. Create Service Worker

Create `frontend/public/service-worker.js`:

```javascript
// Service Worker for Web Push Notifications
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'default',
    requireInteraction: false
  };

  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (error) {
      console.error('Error parsing push data:', error);
    }
  }

  const { title, body, icon, badge, tag, data, requireInteraction, vibrate } = notificationData;

  const options = {
    body,
    icon: icon || '/icon-192x192.png',
    badge: badge || '/badge-72x72.png',
    tag: tag || 'default',
    data: data || {},
    requireInteraction: requireInteraction || false,
    vibrate: vibrate || [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if none found
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
```

### 2. Register Service Worker

Create `frontend/src/utils/pushNotification.js`:

```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Check if push notifications are supported
 */
export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications');
  }

  const permission = await Notification.requestPermission();
  return permission;
};

/**
 * Register service worker
 */
export const registerServiceWorker = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported');
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    throw error;
  }
};

/**
 * Get VAPID public key from server
 */
export const getVapidPublicKey = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/push/vapid-public-key`);
    return response.data.publicKey;
  } catch (error) {
    console.error('Failed to get VAPID public key:', error);
    throw error;
  }
};

/**
 * Subscribe to push notifications
 */
export const subscribeToPushNotifications = async (token) => {
  try {
    // Check if push is supported
    if (!isPushSupported()) {
      throw new Error('Push notifications are not supported');
    }

    // Request permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    // Register service worker
    const registration = await registerServiceWorker();

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Get VAPID public key
    const vapidPublicKey = await getVapidPublicKey();

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // Get device info
    const deviceInfo = {
      userAgent: navigator.userAgent,
      deviceName: getDeviceName()
    };

    // Send subscription to server
    const response = await axios.post(
      `${API_URL}/api/push/subscribe`,
      {
        subscription: subscription.toJSON(),
        deviceInfo
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    console.log('Push notification subscription successful:', response.data);
    return response.data;

  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    throw error;
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPushNotifications = async (token) => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return { success: true, message: 'No active subscription' };
    }

    // Unsubscribe locally
    await subscription.unsubscribe();

    // Notify server
    const response = await axios.post(
      `${API_URL}/api/push/unsubscribe`,
      { endpoint: subscription.endpoint },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    console.log('Push notification unsubscription successful:', response.data);
    return response.data;

  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    throw error;
  }
};

/**
 * Check if user is subscribed to push notifications
 */
export const checkPushSubscription = async () => {
  try {
    if (!isPushSupported()) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return !!subscription;
  } catch (error) {
    console.error('Failed to check push subscription:', error);
    return false;
  }
};

/**
 * Send test notification
 */
export const sendTestNotification = async (token) => {
  try {
    const response = await axios.post(
      `${API_URL}/api/push/test`,
      {
        title: 'Test Notification',
        message: 'This is a test push notification from LJean System'
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Failed to send test notification:', error);
    throw error;
  }
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper function to get device name
function getDeviceName() {
  const ua = navigator.userAgent;
  
  if (/mobile/i.test(ua)) {
    if (/android/i.test(ua)) return 'Android Mobile';
    if (/iPad|iPhone|iPod/.test(ua)) return 'iOS Device';
    return 'Mobile Device';
  }
  
  if (/tablet/i.test(ua) || /iPad/.test(ua)) {
    return 'Tablet';
  }
  
  return 'Desktop';
}
```

### 3. Add Push Notification UI Component

Create a component for users to enable/disable push notifications:

```jsx
// frontend/src/components/PushNotificationToggle.jsx
import React, { useState, useEffect } from 'react';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  checkPushSubscription,
  isPushSupported
} from '../utils/pushNotification';

const PushNotificationToggle = ({ token }) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    // Check if push is supported
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }

    // Check current subscription status
    checkPushSubscription().then(setIsSubscribed);
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribeFromPushNotifications(token);
        setIsSubscribed(false);
      } else {
        await subscribeToPushNotifications(token);
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error('Failed to toggle push notifications:', error);
      alert('Failed to update push notification settings');
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <div className="text-sm text-gray-500">
        Push notifications are not supported in this browser
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium">Push Notifications</h3>
        <p className="text-xs text-gray-500">
          Receive notifications even when the app is closed
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          isSubscribed ? 'bg-blue-600' : 'bg-gray-200'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isSubscribed ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};

export default PushNotificationToggle;
```

### 4. Integrate into Settings Page

Add the toggle to your user settings or profile page:

```jsx
import PushNotificationToggle from './components/PushNotificationToggle';

// In your settings component:
<PushNotificationToggle token={authToken} />
```

---

## Testing

### 1. Test Push Subscription

```javascript
// Test subscribing
import { subscribeToPushNotifications } from './utils/pushNotification';

await subscribeToPushNotifications(token);
```

### 2. Send Test Notification

Use the API endpoint:
```bash
curl -X POST http://localhost:5000/api/push/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "message": "This is a test"
  }'
```

### 3. Test with Inventory Alert

Trigger a low stock alert by reducing inventory below threshold. You should receive:
1. WebSocket notification (real-time)
2. Push notification (even if app is closed)

---

## Deployment

### Production Checklist

- [ ] Generate production VAPID keys
- [ ] Add VAPID keys to production environment variables
- [ ] Run database migration on production database
- [ ] Build and deploy frontend with service worker
- [ ] Test push notifications in production environment
- [ ] Configure HTTPS (required for push notifications)
- [ ] Test across different browsers (Chrome, Firefox, Edge)
- [ ] Test on mobile devices (Android, iOS)

### Browser Support

- ✅ Chrome/Edge (full support)
- ✅ Firefox (full support)
- ✅ Safari 16+ (full support on macOS 13+)
- ❌ iOS Safari (limited - only works when app is added to home screen)

---

## Troubleshooting

### Common Issues

**1. Service Worker not registering**
- Check browser console for errors
- Ensure HTTPS is enabled (required except localhost)
- Clear browser cache and try again

**2. Push notifications not received**
- Check notification permission status
- Verify subscription is active in database
- Check browser notification settings
- Test with simple test notification first

**3. VAPID key errors**
- Ensure keys are correctly set in environment
- Verify keys match between frontend and backend
- Regenerate keys if corrupted

**4. 410 Gone errors**
- Subscription has expired
- System automatically deactivates expired subscriptions
- User needs to re-subscribe

**5. iOS Safari issues**
- Push only works when app is added to home screen
- Inform users about this limitation
- Consider showing iOS-specific instructions

---

## Maintenance

### Regular Tasks

**1. Cleanup Inactive Subscriptions**

Run monthly to remove old subscriptions:
```bash
curl -X POST http://localhost:5000/api/push/cleanup \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "daysInactive": 90 }'
```

Or set up a cron job in `server.js`:
```javascript
// Cleanup inactive subscriptions monthly
cron.schedule('0 0 1 * *', async () => {
  await cleanupInactiveSubscriptions(90);
}, { timezone: "Asia/Manila" });
```

**2. Monitor Subscription Count**

Check active subscriptions:
```sql
SELECT 
  user_type,
  is_active,
  COUNT(*) as count
FROM push_subscriptions
GROUP BY user_type, is_active;
```

**3. Monitor Failed Deliveries**

Check application logs for push notification errors and update subscriptions accordingly.

---

## API Reference

### Subscribe to Push Notifications
```
POST /api/push/subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "deviceInfo": {
    "userAgent": "...",
    "deviceName": "Desktop"
  }
}
```

### Unsubscribe from Push Notifications
```
POST /api/push/unsubscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "endpoint": "https://..."
}
```

### Get User Subscriptions
```
GET /api/push/subscriptions
Authorization: Bearer <token>
```

### Send Test Notification
```
POST /api/push/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Test Title",
  "message": "Test message"
}
```

### Get VAPID Public Key (Public)
```
GET /api/push/vapid-public-key
```

### Cleanup Inactive Subscriptions (Admin)
```
POST /api/push/cleanup
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "daysInactive": 90
}
```

---

## Security Considerations

1. **VAPID Private Key**: Never expose or commit to version control
2. **Authentication**: All endpoints (except public key) require valid JWT token
3. **Authorization**: Cleanup endpoint restricted to admin users
4. **Endpoint Validation**: Subscriptions tied to user accounts
5. **HTTPS**: Required for push notifications in production
6. **Rate Limiting**: Already implemented via existing rate limiters

---

## Integration with Existing Notification System

The push notification system works alongside existing notifications:

1. **WebSocket Notifications**: Real-time when user is online
2. **Database Notifications**: User/admin notification tables track read status
3. **Push Notifications**: Delivered even when app is closed

All three systems work together:
- Alert created → Database record
- WebSocket broadcasts to online users
- Push notification sent to all subscribed devices
- User marks as read → Updates database

---

## Future Enhancements

Potential improvements:
- [ ] Rich notifications with images
- [ ] Action buttons in notifications
- [ ] Notification categories/channels
- [ ] Per-alert-type subscription preferences
- [ ] Push notification analytics
- [ ] Batch notification sending
- [ ] Scheduled notifications
- [ ] Notification templates

---

## Support

For issues or questions:
1. Check browser console for errors
2. Verify environment configuration
3. Test with simple test notification
4. Check database subscription records
5. Review server logs for push errors

---

**Last Updated**: January 2025
**Version**: 1.0.0
