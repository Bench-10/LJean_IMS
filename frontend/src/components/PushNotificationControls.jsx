import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { IoNotificationsOffOutline, IoNotificationsOutline } from 'react-icons/io5';
import { toast } from 'react-hot-toast';
import { useAuth } from '../authentication/Authentication';
import api from '../utils/api';

const SUPPORTS_PUSH = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
const PUSH_OPT_OUT_KEY = 'push-opt-out';

function PushNotificationControls() {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionState, setPermissionState] = useState(() => (SUPPORTS_PUSH ? Notification.permission : 'unsupported'));
  // removed: isTesting (test push button removed)
  const [persisted, setPersisted] = useState(false);
  const autoSubscribeAttemptedRef = useRef(false);

  const readOptOutFlag = useCallback(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(PUSH_OPT_OUT_KEY) === 'true';
    } catch (error) {
      console.warn('Unable to read push opt-out flag', error);
      return false;
    }
  }, []);

  const writeOptOutFlag = useCallback((value) => {
    if (typeof window === 'undefined') return;
    try {
      if (value) {
        localStorage.setItem(PUSH_OPT_OUT_KEY, 'true');
      } else {
        localStorage.removeItem(PUSH_OPT_OUT_KEY);
      }
    } catch (error) {
      console.warn('Unable to update push opt-out flag', error);
    }
  }, []);

  useEffect(() => {
    if (!SUPPORTS_PUSH) return;
    setPermissionState(Notification.permission);
    autoSubscribeAttemptedRef.current = false;

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

  useEffect(() => {
    if (!SUPPORTS_PUSH || !navigator.permissions?.query) return undefined;

    let permissionStatus;
    let active = true;

    const handlePermissionChange = () => {
      if (!permissionStatus) return;
      const nextState = permissionStatus.state === 'prompt' ? 'default' : permissionStatus.state;
      setPermissionState(nextState);

      if (nextState === 'granted') {
        autoSubscribeAttemptedRef.current = false;
        checkSubscription();
      }

      if (nextState === 'denied') {
        setIsEnabled(false);
        writeOptOutFlag(true);
      }
    };

    navigator.permissions.query({ name: 'notifications' }).then((status) => {
      if (!active) return;
      permissionStatus = status;
      const initialState = status.state === 'prompt' ? 'default' : status.state;
      setPermissionState(initialState);
      status.addEventListener('change', handlePermissionChange);
    }).catch((error) => {
      console.warn('Unable to watch notification permission changes', error);
    });

    return () => {
      active = false;
      if (permissionStatus?.removeEventListener) {
        permissionStatus.removeEventListener('change', handlePermissionChange);
      }
    };
  }, [user]);

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

  const ensurePersistentStorage = useCallback(async () => {
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
  }, []);

  const performSilentResubscription = useCallback(async () => {
    if (!user || !SUPPORTS_PUSH) return false;

    try {
      if (Notification.permission !== 'granted') {
        setIsEnabled(false);
        return false;
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

      console.log('Performed silent resubscription');
      setIsEnabled(true);
      const storagePersisted = persisted || await ensurePersistentStorage();
      if (!storagePersisted) {
        console.warn('Silent resubscription active but storage not persisted; background delivery may be limited.');
      }
      writeOptOutFlag(false);
      return true;
    } catch (error) {
      console.error('Silent resubscription failed:', error);
      setIsEnabled(false);
      return false;
    }
  }, [user, persisted, ensurePersistentStorage, writeOptOutFlag]);

  const autoRepairSubscription = useCallback(async (existingSubscription) => {
    if (!user) return;

    try {
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
      writeOptOutFlag(false);
    } catch (repairError) {
      console.warn('Failed to auto-repair subscription:', repairError);
      const repaired = await performSilentResubscription();
      if (!repaired) {
        console.warn('Silent resubscription attempt did not succeed after auto-repair failure.');
        setIsEnabled(false);
      }
    }
  }, [user, writeOptOutFlag, performSilentResubscription]);

  const checkSubscription = useCallback(async () => {
    if (!SUPPORTS_PUSH || !user) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const localSubscription = await registration.pushManager.getSubscription();
      const userOptedOut = readOptOutFlag();

      if (!localSubscription) {
        setIsEnabled(false);

        if (Notification.permission === 'granted' && !autoSubscribeAttemptedRef.current && !userOptedOut) {
          autoSubscribeAttemptedRef.current = true;
          const resubSuccess = await performSilentResubscription();
          if (!resubSuccess) {
            console.warn('Auto subscription attempt failed despite granted permission.');
          }
        }

        return;
      }

      try {
        const { data } = await api.get('/api/push/subscriptions');
        const serverSubscriptions = data?.subscriptions || [];
        const serverSubscription = serverSubscriptions.find(sub =>
          sub.endpoint === localSubscription.endpoint && sub.is_active
        );

        if (serverSubscription) {
          setIsEnabled(true);
          if (userOptedOut) {
            writeOptOutFlag(false);
          }
        } else {
          console.log('Local subscription found but inactive on server, attempting auto-repair...');
          await autoRepairSubscription(localSubscription);
        }
      } catch (serverError) {
        console.warn('Failed to check server subscription status:', serverError);
        setIsEnabled(true);
      }
    } catch (error) {
      console.error('Check subscription error:', error);
      setIsEnabled(false);
    }
  }, [user, performSilentResubscription, autoRepairSubscription, readOptOutFlag, writeOptOutFlag]);

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
  writeOptOutFlag(false);

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
      writeOptOutFlag(true);
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
      writeOptOutFlag(true);
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
      </div>

      {/* Status and debug info */}
      <div className="text-xs text-gray-600">
        <div>{statusLabel}</div>
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
