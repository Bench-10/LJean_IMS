import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../authentication/Authentication';
import api from '../utils/api';

const SUPPORTS_PUSH = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

function PushNotificationControls() {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [permissionState, setPermissionState] = useState(() => (SUPPORTS_PUSH ? Notification.permission : 'unsupported'));
  const [persisted, setPersisted] = useState(false);
  const autoPermissionRequestRef = useRef(false);

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

  const handlePermissionDenied = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        try {
          await existing.unsubscribe();
        } catch (unsubscribeError) {
          console.warn('Local unsubscribe failed after denial:', unsubscribeError);
        }
        try {
          await api.post('/api/push/unsubscribe', { endpoint: existing.endpoint });
        } catch (serverError) {
          console.warn('Server unsubscribe failed after denial:', serverError);
        }
      }
    } catch (error) {
      console.warn('Service worker not ready during denied cleanup:', error);
    }
    setIsEnabled(false);
  }, []);

  const ensureSubscription = useCallback(async () => {
    if (!SUPPORTS_PUSH || !user) {
      setIsEnabled(false);
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const { data } = await api.get('/api/push/vapid-public-key');
        const publicKey = data?.publicKey;
        if (!publicKey) {
          throw new Error('Server did not return VAPID public key');
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

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

      setIsEnabled(true);
      await ensurePersistentStorage();
      return true;
    } catch (error) {
      console.warn('Failed to ensure push subscription:', error);
      setIsEnabled(false);
      return false;
    }
  }, [user, ensurePersistentStorage]);

  useEffect(() => {
    if (!SUPPORTS_PUSH) {
      setIsEnabled(false);
      return;
    }

    autoPermissionRequestRef.current = false;
    setPermissionState(Notification.permission);

    const syncState = async () => {
      if (navigator.storage?.persisted) {
        try {
          const alreadyPersisted = await navigator.storage.persisted();
          setPersisted(alreadyPersisted);
        } catch (error) {
          console.warn('Failed to check persistent storage', error);
        }
      }

      const currentPermission = Notification.permission;
      if (currentPermission === 'denied') {
        await handlePermissionDenied();
        return;
      }

      if (!user) {
        setIsEnabled(false);
        return;
      }

      if (currentPermission === 'granted') {
        await ensureSubscription();
        return;
      }

      if (currentPermission === 'default' && !autoPermissionRequestRef.current) {
        autoPermissionRequestRef.current = true;
        try {
          const requested = await Notification.requestPermission();
          setPermissionState(requested);
          if (requested === 'granted') {
            await ensureSubscription();
          } else if (requested === 'denied') {
            await handlePermissionDenied();
          }
        } catch (error) {
          console.warn('Notification permission request failed:', error);
        }
      }
    };

    syncState();
  }, [user, ensureSubscription, handlePermissionDenied]);

  useEffect(() => {
    if (!SUPPORTS_PUSH || !navigator.permissions?.query) return undefined;

    let permissionStatus;
    let active = true;

    const handleChange = async () => {
      if (!permissionStatus) return;
      const nextState = permissionStatus.state === 'prompt' ? 'default' : permissionStatus.state;
      setPermissionState(nextState);
      if (nextState === 'granted') {
        await ensureSubscription();
      } else if (nextState === 'denied') {
        await handlePermissionDenied();
      } else {
        setIsEnabled(false);
      }
    };

    navigator.permissions.query({ name: 'notifications' }).then((status) => {
      if (!active) return;
      permissionStatus = status;
      const initialState = status.state === 'prompt' ? 'default' : status.state;
      setPermissionState(initialState);
      status.addEventListener('change', handleChange);
    }).catch((error) => {
      console.warn('Unable to watch notification permission changes', error);
    });

    return () => {
      active = false;
      if (permissionStatus?.removeEventListener) {
        permissionStatus.removeEventListener('change', handleChange);
      }
    };
  }, [ensureSubscription, handlePermissionDenied]);

  useEffect(() => {
    if (!SUPPORTS_PUSH) return undefined;

    let cancelled = false;

    const updateLocalState = async () => {
      if (!user) {
        setIsEnabled(false);
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setIsEnabled(Boolean(subscription));
        }
      } catch (error) {
        console.warn('Failed to inspect push subscription:', error);
        if (!cancelled) {
          setIsEnabled(false);
        }
      }
    };

    updateLocalState();

    return () => {
      cancelled = true;
    };
  }, [permissionState, user]);

  const statusLabel = useMemo(() => {
    if (!SUPPORTS_PUSH) return 'Notifications not supported in this browser.';
    if (permissionState === 'denied') return 'Notifications blocked in browser settings.';
    if (permissionState === 'default') return 'Allow notifications in your browser to receive alerts.';
    if (!isEnabled) return 'Permission granted. Finalizing push registration…';
    if (!persisted) return 'Push notifications enabled. Enable background activity so alerts arrive when the app is closed.';
    return 'Push notifications enabled and ready.';
  }, [isEnabled, permissionState, persisted]);

  if (!SUPPORTS_PUSH) {
    return null;
  }

  return (
    <div className="text-xs text-gray-600">
      <div>{statusLabel}</div>
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
