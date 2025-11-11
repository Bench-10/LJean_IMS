import api from '../utils/api';

/**
 * Convert VAPID public key from base64 to Uint8Array
 * @param {string} base64String - VAPID public key in base64 format
 * @returns {Uint8Array}
 */
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

/**
 * Get device information for push subscription
 * @returns {Object}
 */
function getDeviceInfo() {
  const userAgent = navigator.userAgent;
  let deviceName = 'Unknown Device';

  if (/Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)) {
    if (/iPhone/i.test(userAgent)) deviceName = 'iPhone';
    else if (/iPad/i.test(userAgent)) deviceName = 'iPad';
    else if (/Android/i.test(userAgent)) deviceName = 'Android Device';
    else deviceName = 'Mobile Device';
  } else {
    deviceName = 'Desktop';
  }

  return {
    userAgent,
    deviceName
  };
}

/**
 * Request notification permission from user
 * @returns {Promise<boolean>} - true if granted, false otherwise
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('Notification permission was denied');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Subscribe to push notifications
 * @param {Object} user - User object with user_id or admin_id
 * @returns {Promise<Object>} - Subscription result
 */
export async function subscribeToPushNotifications(user) {
  try {
    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers are not supported');
    }

    // Check if push messaging is supported
    if (!('PushManager' in window)) {
      throw new Error('Push messaging is not supported');
    }

    // Request permission
    const permissionGranted = await requestNotificationPermission();
    if (!permissionGranted) {
      throw new Error('Notification permission not granted');
    }

    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;

    // Get VAPID public key from server
    let vapidData;
    try {
      console.log('[Push Service] Fetching VAPID key from: /push/vapid-public-key');
      const response = await api.get('/push/vapid-public-key');
      console.log('[Push Service] VAPID response:', response);
      vapidData = response.data;
      console.log('[Push Service] VAPID data:', vapidData);
    } catch (error) {
      console.error('[Push Service] Failed to fetch VAPID key:', error);
      console.error('[Push Service] Error response:', error.response?.data);
      console.error('[Push Service] Error status:', error.response?.status);
      throw new Error(`Failed to get VAPID public key from server: ${error.response?.data?.message || error.message}`);
    }

    const vapidPublicKey = vapidData?.publicKey;
    console.log('[Push Service] Extracted public key:', vapidPublicKey ? `${vapidPublicKey.substring(0, 20)}...` : 'EMPTY');

    if (!vapidPublicKey) {
      console.error('[Push Service] vapidData:', vapidData);
      throw new Error('VAPID public key is empty or not configured on server');
    }

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // Send subscription to server
    const userId = user?.user_id || null;
    const adminId = user?.admin_id || null;
    const userType = adminId ? 'admin' : 'user';

    const response = await api.post('/push/subscribe', {
      userId,
      adminId,
      userType,
      subscription: subscription.toJSON(),
      deviceInfo: getDeviceInfo()
    });

    console.log('Push notification subscription successful:', response.data);
    return {
      success: true,
      subscription: response.data
    };

  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Unsubscribe from push notifications
 * @returns {Promise<Object>} - Unsubscribe result
 */
export async function unsubscribeFromPushNotifications() {
  try {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers are not supported');
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return {
        success: true,
        message: 'No active subscription found'
      };
    }

    // Unsubscribe from browser
    await subscription.unsubscribe();

    // Notify server
    await api.post('/push/unsubscribe', {
      endpoint: subscription.endpoint
    });

    console.log('Push notification unsubscription successful');
    return {
      success: true,
      message: 'Successfully unsubscribed'
    };

  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if user is subscribed to push notifications
 * @returns {Promise<boolean>}
 */
export async function isPushSubscribed() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return subscription !== null;

  } catch (error) {
    console.error('Error checking push subscription:', error);
    return false;
  }
}

/**
 * Get current push subscription
 * @returns {Promise<Object|null>}
 */
export async function getPushSubscription() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return subscription ? subscription.toJSON() : null;

  } catch (error) {
    console.error('Error getting push subscription:', error);
    return null;
  }
}
