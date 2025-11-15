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
        const userId = req.user.userId || req.user.id || req.user.user_id;
        const adminId = req.user.adminId || req.user.admin_id || null;
        const role = req.user.role;

        // Prefer storing subscriptions against the Users table unless a real admin_id exists
        // Owners are regular users with the "Owner" role and typically do not have an Administrator.admin_id
        // So only treat an account as 'admin' when an explicit adminId is present.
        const userType = adminId ? 'admin' : 'user';

        // Fallback: if frontend provided userId/adminId in the body, accept it (helps some clients)
        const bodyUserId = req.body.userId || req.body.user_id || null;
        const bodyAdminId = req.body.adminId || req.body.admin_id || null;

        const resolvedAdminId = adminId || bodyAdminId || null;
        const resolvedUserId = userId || bodyUserId || null;

        const result = await subscribeToPush({
            userId: userType === 'user' ? resolvedUserId : null,
            adminId: userType === 'admin' ? resolvedAdminId : null,
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
        const userId = req.user.userId || req.user.id || req.user.user_id;
        const adminId = req.user.adminId || req.user.admin_id || null;
        const role = req.user.role;

        const bodyUserId = req.query.userId || req.query.user_id || null;
        const bodyAdminId = req.query.adminId || req.query.admin_id || null;

        const resolvedAdminId = adminId || bodyAdminId || null;
        const resolvedUserId = userId || bodyUserId || null;

        // Treat as 'admin' only when an admin id exists; Owners remain 'user' entries in the Users table
        const userType = resolvedAdminId ? 'admin' : 'user';

        const result = await getUserSubscriptions(
            userType === 'user' ? resolvedUserId : null,
            userType === 'admin' ? resolvedAdminId : null,
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
        const userId = req.user.userId || req.user.id || req.user.user_id;
        const adminId = req.user.adminId || req.user.admin_id || null;
        const role = req.user.role;

        const bodyUserId = req.body.userId || req.body.user_id || null;
        const bodyAdminId = req.body.adminId || req.body.admin_id || null;

        const resolvedAdminId = adminId || bodyAdminId || null;
        const resolvedUserId = userId || bodyUserId || null;

        // Treat as 'admin' only when an admin id exists
        const userType = resolvedAdminId ? 'admin' : 'user';

        const notificationData = {
            title: title || 'Test Notification',
            body: message || 'This is a test push notification',
            icon: '/LOGO.png', // App logo icon for notifications
            badge: '/LOGO.png', // Badge icon for notifications
            tag: `test-${Date.now()}`,
            data: {
                url: '/notifications',
                timestamp: new Date().toISOString()
            }
        };

        const result = await sendPushNotification({
            userId: userType === 'user' ? resolvedUserId : null,
            adminId: userType === 'admin' ? resolvedAdminId : null,
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
        const publicKey = getVapidPublicKey();

        res.status(200).json({
            success: true,
            publicKey
        });

    } catch (error) {
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
