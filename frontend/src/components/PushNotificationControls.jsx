import { useEffect, useState } from 'react';
import { useAuth } from '../authentication/Authentication';
import { 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications, 
  isPushSubscribed 
} from '../services/pushNotificationService';
import { toast } from 'react-hot-toast';
import { IoNotificationsOutline, IoNotificationsOffOutline } from 'react-icons/io5';

/**
 * Component to manage push notification subscription
 * Automatically subscribes users on mount if permission is granted
 * Shows UI to enable/disable push notifications
 */
function PushNotificationControls() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionState, setPermissionState] = useState('default');

  // Check subscription status on mount
  useEffect(() => {
    checkSubscriptionStatus();
  }, [user]);

  // Auto-subscribe if permission already granted and not subscribed
  useEffect(() => {
    if (user && permissionState === 'granted' && !isSubscribed) {
      autoSubscribe();
    }
  }, [user, permissionState, isSubscribed]);

  const checkSubscriptionStatus = async () => {
    if (!('Notification' in window)) {
      return;
    }

    setPermissionState(Notification.permission);
    const subscribed = await isPushSubscribed();
    setIsSubscribed(subscribed);
  };

  const autoSubscribe = async () => {
    if (!user) return;

    try {
      const result = await subscribeToPushNotifications(user);
      if (result.success) {
        setIsSubscribed(true);
        console.log('Auto-subscribed to push notifications');
      }
    } catch (error) {
      console.error('Auto-subscribe failed:', error);
      // Silently fail - don't show toast for auto-subscribe
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast.error('You must be logged in to enable notifications');
      return;
    }

    setIsLoading(true);

    try {
      const result = await subscribeToPushNotifications(user);

      if (result.success) {
        setIsSubscribed(true);
        setPermissionState('granted');
        toast.success('Push notifications enabled! You\'ll receive notifications even when the app is closed.');
      } else {
        toast.error(result.error || 'Failed to enable push notifications');
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      toast.error('Failed to enable push notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);

    try {
      const result = await unsubscribeFromPushNotifications();

      if (result.success) {
        setIsSubscribed(false);
        toast.success('Push notifications disabled');
      } else {
        toast.error(result.error || 'Failed to disable push notifications');
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
      toast.error('Failed to disable push notifications');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show anything if notifications aren't supported
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return null;
  }

  // Don't show if permission is denied
  if (permissionState === 'denied') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
        <IoNotificationsOffOutline className="w-5 h-5" />
        <span>Push notifications blocked. Enable in browser settings.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
          transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
          ${isSubscribed 
            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }
        `}
        title={isSubscribed ? 'Disable push notifications' : 'Enable push notifications'}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isSubscribed ? (
          <IoNotificationsOutline className="w-5 h-5" />
        ) : (
          <IoNotificationsOffOutline className="w-5 h-5" />
        )}
        <span>
          {isLoading ? 'Processing...' : isSubscribed ? 'Push Enabled' : 'Enable Push Notifications'}
        </span>
      </button>

      {isSubscribed && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg text-xs text-green-700">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>You'll receive notifications even when the app is closed</span>
        </div>
      )}
    </div>
  );
}

export default PushNotificationControls;
