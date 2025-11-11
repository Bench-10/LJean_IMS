import { useEffect, useState } from 'react';
import { useAuth } from '../authentication/Authentication';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { IoNotificationsOutline, IoNotificationsOffOutline } from 'react-icons/io5';

/**
 * Simple push notification toggle
 * Push notifications work even when browser is closed (via service worker)
 */
function PushNotificationControls() {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if already subscribed on mount
  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsEnabled(!!subscription);
    } catch (error) {
      console.error('Check subscription error:', error);
    }
  };

  const handleToggle = async () => {
    if (isEnabled) {
      await handleDisable();
    } else {
      await handleEnable();
    }
  };

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      // 1. Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notification permission denied');
        return;
      }

      // 2. Get service worker and VAPID key
      const registration = await navigator.serviceWorker.ready;
      const { data } = await api.get('/push/vapid-public-key');
      
      // 3. Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey)
      });

      // 4. Send to backend
      await api.post('/push/subscribe', {
        userId: user?.user_id,
        adminId: user?.admin_id,
        userType: user?.admin_id ? 'admin' : 'user',
        subscription: subscription.toJSON(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          deviceName: /Mobile/.test(navigator.userAgent) ? 'Mobile' : 'Desktop'
        }
      });

      setIsEnabled(true);
      toast.success('✅ Push notifications enabled! Works even when browser is closed.');
    } catch (error) {
      console.error('Enable error:', error);
      toast.error('Failed to enable: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
      }

      setIsEnabled(false);
      toast.success('Push notifications disabled');
    } catch (error) {
      console.error('Disable error:', error);
      toast.error('Failed to disable');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to convert VAPID key
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Don't show if not supported
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
          transition-colors disabled:opacity-50
          ${isEnabled 
            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }
        `}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isEnabled ? (
          <IoNotificationsOutline className="w-5 h-5" />
        ) : (
          <IoNotificationsOffOutline className="w-5 h-5" />
        )}
        <span>
          {isLoading ? 'Processing...' : isEnabled ? 'Push Enabled' : 'Enable Push'}
        </span>
      </button>

      {isEnabled && (
        <span className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">
          ✓ Works even when browser closed
        </span>
      )}
    </div>
  );
}

export default PushNotificationControls;
