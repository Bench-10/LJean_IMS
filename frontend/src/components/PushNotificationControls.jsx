import { useEffect, useMemo, useState } from 'react';
import { IoNotificationsOffOutline, IoNotificationsOutline } from 'react-icons/io5';
import { toast } from 'react-hot-toast';
import { useAuth } from '../authentication/Authentication';
import api from '../utils/api';

const SUPPORTS_PUSH = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

function PushNotificationControls() {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionState, setPermissionState] = useState(() => (SUPPORTS_PUSH ? Notification.permission : 'unsupported'));
  // removed: isTesting (test push button removed)
  const [persisted, setPersisted] = useState(false);

  useEffect(() => {
    if (!SUPPORTS_PUSH) return;
    setPermissionState(Notification.permission);

    const init = async () => {
      if (navigator.storage?.persisted) {
        try {
          const alreadyPersisted = await navigator.storage.persisted();
          setPersisted(alreadyPersisted);
        } catch (error) {
          console.warn('Failed to check persistent storage', error);
        }
      }

      checkSubscription();
      // If the user has denied notifications at the browser level,
      // try to clean up any existing push subscription and notify the server.
      if (Notification.permission === 'denied') {
        try {
          const registration = await navigator.serviceWorker.ready;
          const existing = await registration.pushManager.getSubscription();
          if (existing) {
            // Unsubscribe locally
            try {
              await existing.unsubscribe();
            } catch (e) {
              console.warn('Failed to unsubscribe locally from denied permission:', e);
            }
            // Tell server to mark it inactive so it doesn't receive pushes
            try {
              await api.post('/api/push/unsubscribe', { endpoint: existing.endpoint });
            } catch (e) {
              console.warn('Failed to notify server about unsubscription on denied permission:', e);
            }
            setIsEnabled(false);
          }
        } catch (err) {
          console.warn('Service worker not ready while auto-unsubscribing denied client', err);
        }
      }
    };

    init();
  }, [user]); // Re-run when user changes

  const statusLabel = useMemo(() => {
    if (!SUPPORTS_PUSH) return 'Notifications not supported in this browser.';
    if (permissionState === 'denied') return 'Notifications blocked in browser settings.';
    if (permissionState === 'default') return 'Not enabled yet.';
    if (!isEnabled) return 'Permission granted, but device not subscribed yet.';
    if (!persisted) return 'Subscribed. Enable background activity so pushes arrive when closed.';
    return 'Push notifications active and ready to work in the background.';
  }, [isEnabled, permissionState, persisted]);

  // Additional status for debugging
  const debugInfo = useMemo(() => {
    if (!SUPPORTS_PUSH) return null;
    return {
      permission: permissionState,
      hasSubscription: isEnabled,
      persisted,
      userAgent: navigator.userAgent.substring(0, 50) + '...'
    };
  }, [isEnabled, permissionState, persisted]);

  const checkSubscription = async () => {
    if (!SUPPORTS_PUSH || !user) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const localSubscription = await registration.pushManager.getSubscription();
      
      if (!localSubscription) {
        setIsEnabled(false);
        return;
      }

      // Check if subscription is active on server
      try {
        const { data } = await api.get('/api/push/subscriptions');
        const serverSubscriptions = data?.subscriptions || [];
        
        // Check if current endpoint exists and is active on server
        const serverSubscription = serverSubscriptions.find(sub => 
          sub.endpoint === localSubscription.endpoint && sub.is_active
        );

        if (serverSubscription) {
          // Subscription is active on both client and server
          setIsEnabled(true);
        } else {
          // Local subscription exists but server says it's inactive
          // Try to re-subscribe automatically
          console.log('Local subscription found but inactive on server, attempting auto-repair...');
          await autoRepairSubscription(localSubscription);
        }
      } catch (serverError) {
        console.warn('Failed to check server subscription status:', serverError);
        // If we can't check server status, assume local subscription is valid
        // but mark as potentially needing repair
        setIsEnabled(true);
      }
    } catch (error) {
      console.error('Check subscription error:', error);
      setIsEnabled(false);
    }
  };

  const autoRepairSubscription = async (existingSubscription) => {
    if (!user) return;

    try {
      // Try to re-subscribe with existing endpoint
      await api.post('/api/push/subscribe', {
        userId: user?.user_id,
        adminId: user?.admin_id,
        userType: user?.admin_id ? 'admin' : 'user',
        subscription: existingSubscription.toJSON(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          deviceName: /Mobile/.test(navigator.userAgent) ? 'Mobile' : 'Desktop'
        }
      });

      console.log('Auto-repaired push subscription');
      setIsEnabled(true);
    } catch (repairError) {
      console.warn('Failed to auto-repair subscription:', repairError);
      // If auto-repair fails, try full re-subscription
      try {
        await performSilentResubscription();
      } catch (resubError) {
        console.warn('Failed to perform silent resubscription:', resubError);
        setIsEnabled(false);
      }
    }
  };

  const performSilentResubscription = async () => {
    if (!user || !SUPPORTS_PUSH) return;

    try {
      // Check permission first
      if (Notification.permission !== 'granted') {
        setIsEnabled(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Get VAPID key
      const { data } = await api.get('/api/push/vapid-public-key');
      if (!data?.publicKey) {
        throw new Error('Server did not return VAPID public key');
      }

      // Create new subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey)
      });

      // Subscribe on server
      await api.post('/api/push/subscribe', {
        userId: user?.user_id,
        adminId: user?.admin_id,
        userType: user?.admin_id ? 'admin' : 'user',
        subscription: subscription.toJSON(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          deviceName: /Mobile/.test(navigator.userAgent) ? 'Mobile' : 'Desktop'
        }
      });

      console.log('Performed silent resubscription');
      setIsEnabled(true);
    } catch (error) {
      console.error('Silent resubscription failed:', error);
      setIsEnabled(false);
    }
  };

  const ensurePersistentStorage = async () => {
    if (!navigator.storage?.persist) return false;
    try {
      const granted = await navigator.storage.persist();
      if (granted) {
        setPersisted(true);
      }
      return granted;
    } catch (error) {
      console.warn('Failed to persist storage', error);
      return false;
    }
  };

  const handleToggle = async () => {
    if (isEnabled) {
      // Disable across all devices (global) when toggling off
      await handleDisableAll();
    } else {
      await handleEnable();
    }
  };

  const handleEnable = async () => {
    if (!SUPPORTS_PUSH) {
      toast.error('Browser does not support push notifications.');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to enable notifications');
      return;
    }

    setIsLoading(true);

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== 'granted') {
        toast.error('Notification permission denied in browser settings');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const { data } = await api.get('/api/push/vapid-public-key');

      if (!data?.publicKey) {
        throw new Error('Server did not return VAPID public key');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey)
      });

      await api.post('/api/push/subscribe', {
        userId: user?.user_id,
        adminId: user?.admin_id,
        userType: user?.admin_id ? 'admin' : 'user',
        subscription: subscription.toJSON(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          deviceName: /Mobile/.test(navigator.userAgent) ? 'Mobile' : 'Desktop'
        }
      });

  const storagePersisted = persisted || await ensurePersistentStorage();
  setIsEnabled(true);

  const persistenceMessage = storagePersisted ? '' : '\nEnsure Edge/Chrome "Continue running background apps" (desktop) or App > Notifications (mobile) is enabled so pushes arrive when closed.';
      toast.success(`Push notifications enabled!${persistenceMessage}`);
      if (window.confirm('Push notifications enabled. Please refresh the page to apply changes.')) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Enable error:', error);
      toast.error(`Failed to enable: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    // kept for backward compatibility; will not be used directly anymore in the UI
    if (!SUPPORTS_PUSH) return;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await api.post('/api/push/unsubscribe', { endpoint: subscription.endpoint });
      }
      setIsEnabled(false);
      toast.success('Push notifications disabled');
      if (window.confirm('Push notifications disabled. Please refresh the page to apply changes.')) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Disable error:', error);
      toast.error('Failed to disable push notifications');
    } finally {
      setIsLoading(false);
    }
  };

  // Disable push for all devices associated with the account
  const handleDisableAll = async () => {
    if (!SUPPORTS_PUSH) return;
    setIsLoading(true);
    try {
      // First attempt to unsubscribe locally
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      } catch (localErr) {
        console.warn('Local unsubscribe error in handleDisableAll:', localErr);
      }

      // Then tell server to mark all subscription records for this account inactive
      await api.post('/api/push/unsubscribe', { global: true });
      setIsEnabled(false);
      toast.success('Push notifications disabled for all devices');
      if (window.confirm('Push notifications disabled. Please refresh the page to apply changes.')) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Disable all error:', error);
      toast.error('Failed to disable push notifications for all devices');
    } finally {
      setIsLoading(false);
    }
  };

  // Test notification function to verify push notifications are working
  const testNotification = async () => {
    if (!isEnabled || !user) return;

    try {
      await api.post('/api/push/test', {
        title: 'Test Notification',
        message: 'This is a test to verify push notifications are working.'
      });
      toast.success('Test notification sent! Check if you received it.');
    } catch (error) {
      console.error('Test notification failed:', error);
      toast.error('Test notification failed. Push notifications may not be working properly.');
      
      // If test fails, try to repair subscription
      if (window.confirm('Push notifications appear to not be working. Would you like to try repairing them?')) {
        await performSilentResubscription();
      }
    }
  };

  if (!SUPPORTS_PUSH) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            ${isEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}
          `}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isEnabled ? (
            <IoNotificationsOutline className="w-5 h-5" />
          ) : (
            <IoNotificationsOffOutline className="w-5 h-5" />
          )}
          <span>{isLoading ? 'Processing…' : isEnabled ? 'Disable Push Notifications' : 'Enable Push Notifications'}</span>
        </button>

        {/* Test notification button when enabled */}
        {isEnabled && (
          <button
            onClick={testNotification}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Test Notification
          </button>
        )}

        {/* Disable all is now performed by toggling off the button */}
      </div>

      {/* Status and debug info */}
      <div className="text-xs text-gray-600">
        <div>{statusLabel}</div>
        {debugInfo && (
          <details className="mt-1">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Debug Info</summary>
            <div className="mt-1 pl-2 border-l-2 border-gray-200 text-xs">
              <div>Permission: {debugInfo.permission}</div>
              <div>Has Subscription: {debugInfo.hasSubscription ? 'Yes' : 'No'}</div>
              <div>Persistent Storage: {debugInfo.persisted ? 'Yes' : 'No'}</div>
              <div>User Agent: {debugInfo.userAgent}</div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default PushNotificationControls;
