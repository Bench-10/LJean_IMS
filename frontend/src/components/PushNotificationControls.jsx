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
  const [isTesting, setIsTesting] = useState(false);
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
    };

    init();
  }, []);

  const statusLabel = useMemo(() => {
    if (!SUPPORTS_PUSH) return 'Notifications not supported in this browser.';
    if (permissionState === 'denied') return 'Notifications blocked in browser settings.';
    if (permissionState === 'default') return 'Not enabled yet.';
    if (!isEnabled) return 'Permission granted, but device not subscribed yet.';
    if (!persisted) return 'Subscribed. Enable background activity so pushes arrive when closed.';
    return 'Push notifications active and ready to work in the background.';
  }, [isEnabled, permissionState, persisted]);

  const checkSubscription = async () => {
    if (!SUPPORTS_PUSH) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsEnabled(Boolean(subscription));
    } catch (error) {
      console.error('Check subscription error:', error);
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
      await handleDisable();
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
      toast.success(`✅ Push notifications enabled!${persistenceMessage}`);
    } catch (error) {
      console.error('Enable error:', error);
      toast.error(`Failed to enable: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
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
    } catch (error) {
      console.error('Disable error:', error);
      toast.error('Failed to disable push notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    try {
      await api.post('/api/push/test', {
        title: 'Push Test',
        message: 'If you see this while the app is closed, background push works!'
      });
      toast.success('Test notification sent. Close the app and check your notification tray.');
    } catch (error) {
      console.error('Test push error:', error);
      toast.error('Failed to send test notification');
    } finally {
      setIsTesting(false);
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
          <span>{isLoading ? 'Processing…' : isEnabled ? 'Push Enabled' : 'Enable Push'}</span>
        </button>

        <button
          onClick={handleSendTest}
          disabled={!isEnabled || isTesting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? 'Sending…' : 'Send Test Notification'}
        </button>
      </div>

      <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <div className="font-medium text-slate-700 mb-1">Status: {statusLabel}</div>
        {permissionState === 'denied' ? (
          <div>
            Enable notifications in your browser settings (Edge/Chrome → Site permissions → Notifications) and try again.
          </div>
        ) : (
          <ul className="list-disc pl-4 space-y-1">
            <li>Close and reopen the app after enabling to confirm push delivery.</li>
            <li>Desktop Edge/Chrome: enable "Continue running background apps" so pushes arrive when the window is closed.</li>
            <li>Android: long-press the app icon → Notifications → allow background & notification access.</li>
            <li>If pushes still fail, the server may be unable to send (check PM2 logs for push errors).</li>
          </ul>
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
