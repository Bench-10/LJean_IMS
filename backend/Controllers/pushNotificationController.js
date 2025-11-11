import {
    subscribeToPush,
    unsubscribeFromPush,
    getUserSubscriptions,
    sendPushNotification,
    getVapidPublicKey,
    cleanupInactiveSubscriptions
} from '../Services/pushNotificationService.js';

/**
 * Subscribe user to push notifications
 * POST /api/push/subscribe
 * Body: { subscription: PushSubscription object, deviceInfo: { deviceName, userAgent } }
 */
export const subscribe = async (req, res) => {
    try {
        const { subscription, deviceInfo } = req.body;
        const { userId, adminId, role } = req.user;

        // Determine user type based on role
        const userType = role?.includes('Owner') || role?.includes('Admin') ? 'admin' : 'user';

        const result = await subscribeToPush({
            userId: userType === 'user' ? userId : null,
            adminId: userType === 'admin' ? adminId : null,
            userType,
            subscription,
            deviceInfo
        });

        res.status(200).json(result);

    } catch (error) {
        console.error('Error in subscribe controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to subscribe to push notifications',
            error: error.message
        });
    }
};

/**
 * Unsubscribe from push notifications
 * POST /api/push/unsubscribe
 * Body: { endpoint: string }
 */
export const unsubscribe = async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({
                success: false,
                message: 'Endpoint is required'
            });
        }

        const result = await unsubscribeFromPush(endpoint);
        res.status(200).json(result);

    } catch (error) {
        console.error('Error in unsubscribe controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unsubscribe from push notifications',
            error: error.message
        });
    }
};

/**
 * Get user's active subscriptions
 * GET /api/push/subscriptions
 */
export const getSubscriptions = async (req, res) => {
    try {
        const { userId, adminId, role } = req.user;

        // Determine user type based on role
        const userType = role?.includes('Owner') || role?.includes('Admin') ? 'admin' : 'user';

        const result = await getUserSubscriptions(
            userType === 'user' ? userId : null,
            userType === 'admin' ? adminId : null,
            userType
        );

        res.status(200).json(result);

    } catch (error) {
        console.error('Error in getSubscriptions controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve subscriptions',
            error: error.message
        });
    }
};

/**
 * Send test push notification
 * POST /api/push/test
 * Body: { title, message }
 */
export const sendTestNotification = async (req, res) => {
    try {
        const { title, message } = req.body;
        const { userId, adminId, role } = req.user;

        // Determine user type based on role
        const userType = role?.includes('Owner') || role?.includes('Admin') ? 'admin' : 'user';

        const notificationData = {
            title: title || 'Test Notification',
            body: message || 'This is a test push notification',
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            tag: `test-${Date.now()}`,
            data: {
                url: '/notifications',
                timestamp: new Date().toISOString()
            }
        };

        const result = await sendPushNotification({
            userId: userType === 'user' ? userId : null,
            adminId: userType === 'admin' ? adminId : null,
            userType,
            notificationData
        });

        res.status(200).json(result);

    } catch (error) {
        console.error('Error in sendTestNotification controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test notification',
            error: error.message
        });
    }
};

/**
 * Get VAPID public key
 * GET /api/push/vapid-public-key
 */
export const getPublicKey = async (req, res) => {
    try {
        console.log('[getPublicKey Controller] Request received');
        console.log('[getPublicKey Controller] Calling getVapidPublicKey()...');
        
        const publicKey = getVapidPublicKey();
        
        console.log('[getPublicKey Controller] Got key:', publicKey ? `${publicKey.substring(0, 20)}...` : 'EMPTY');
        console.log('[getPublicKey Controller] Sending response');
        
        res.status(200).json({
            success: true,
            publicKey
        });

    } catch (error) {
        console.error('[getPublicKey Controller] ❌ Error:', error.message);
        console.error('[getPublicKey Controller] Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve public key',
            error: error.message
        });
    }
};

/**
 * Cleanup inactive subscriptions (Admin only)
 * POST /api/push/cleanup
 * Body: { daysInactive: number }
 */
export const cleanup = async (req, res) => {
    try {
        const { daysInactive } = req.body;

        // Check if user has admin/owner role
        const { role } = req.user;
        if (!role?.includes('Owner') && !role?.includes('Admin')) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized. Only admins can perform cleanup.'
            });
        }

        const result = await cleanupInactiveSubscriptions(daysInactive || 90);
        res.status(200).json(result);

    } catch (error) {
        console.error('Error in cleanup controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cleanup subscriptions',
            error: error.message
        });
    }
};
