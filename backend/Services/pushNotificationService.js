import webPush from 'web-push';
import { SQLquery } from '../db.js';
import dayjs from 'dayjs';

// VAPID Keys Configuration
// Generate keys using: npx web-push generate-vapid-keys
// Store these in environment variables for production
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'YOUR_PUBLIC_KEY_HERE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'YOUR_PRIVATE_KEY_HERE';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@ljean.com';

// Log VAPID configuration status on module load (helps diagnose issues)
console.log('[Push Notifications] VAPID Configuration:');
console.log('  - Public Key:', VAPID_PUBLIC_KEY === 'YOUR_PUBLIC_KEY_HERE' ? '❌ NOT CONFIGURED (using placeholder)' : '✅ Configured');
console.log('  - Private Key:', VAPID_PRIVATE_KEY === 'YOUR_PRIVATE_KEY_HERE' ? '❌ NOT CONFIGURED (using placeholder)' : '✅ Configured');
console.log('  - Subject:', VAPID_SUBJECT);

// Configure web-push
try {
  webPush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  if (VAPID_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY_HERE') {
    console.log('[Push Notifications] ✅ web-push configured successfully');
  } else {
    console.warn('[Push Notifications] ⚠️  Using placeholder VAPID keys - push notifications will NOT work!');
    console.warn('[Push Notifications] ⚠️  Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment variables');
  }
} catch (error) {
  console.error('[Push Notifications] ❌ Failed to configure web-push:', error.message);
}

/**
 * Subscribe to push notifications
 * @param {Object} subscriptionData - { userId, adminId, userType, subscription, deviceInfo }
 * @returns {Promise<Object>} - Created subscription record
 */
export const subscribeToPush = async (subscriptionData) => {
    try {
        const { userId, adminId, userType, subscription, deviceInfo } = subscriptionData;

        // Validate user type
        if (!['user', 'admin'].includes(userType)) {
            throw new Error('Invalid user type. Must be "user" or "admin"');
        }

        // Validate subscription object
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            throw new Error('Invalid subscription object');
        }

        const { endpoint, keys } = subscription;
        const { p256dh, auth } = keys;

        // Check if subscription already exists
        const existingQuery = `
            SELECT subscription_id, is_active 
            FROM push_subscriptions 
            WHERE endpoint = $1
        `;
        const existing = await SQLquery(existingQuery, [endpoint]);

        if (existing.rows.length > 0) {
            // Update existing subscription
            const updateQuery = `
                UPDATE push_subscriptions
                SET 
                    user_id = $1,
                    admin_id = $2,
                    user_type = $3,
                    p256dh_key = $4,
                    auth_key = $5,
                    user_agent = $6,
                    device_name = $7,
                    is_active = TRUE,
                    last_used = NOW()
                WHERE endpoint = $8
                RETURNING *
            `;
            const result = await SQLquery(updateQuery, [
                userId || null,
                adminId || null,
                userType,
                p256dh,
                auth,
                deviceInfo?.userAgent || null,
                deviceInfo?.deviceName || null,
                endpoint
            ]);
            
            return {
                success: true,
                message: 'Push subscription updated successfully',
                subscription: result.rows[0]
            };
        }

        // Create new subscription
        const insertQuery = `
            INSERT INTO push_subscriptions (
                user_id, admin_id, user_type, endpoint, 
                p256dh_key, auth_key, user_agent, device_name
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        
        const result = await SQLquery(insertQuery, [
            userId || null,
            adminId || null,
            userType,
            endpoint,
            p256dh,
            auth,
            deviceInfo?.userAgent || null,
            deviceInfo?.deviceName || null
        ]);

        return {
            success: true,
            message: 'Push subscription created successfully',
            subscription: result.rows[0]
        };

    } catch (error) {
        console.error('Error in subscribeToPush:', error);
        throw error;
    }
};

/**
 * Unsubscribe from push notifications
 * @param {string} endpoint - Subscription endpoint to remove
 * @returns {Promise<Object>} - Success status
 */
export const unsubscribeFromPush = async (endpoint) => {
    try {
        const query = `
            UPDATE push_subscriptions
            SET is_active = FALSE
            WHERE endpoint = $1
            RETURNING *
        `;
        
        const result = await SQLquery(query, [endpoint]);

        if (result.rows.length === 0) {
            return {
                success: false,
                message: 'Subscription not found'
            };
        }

        return {
            success: true,
            message: 'Successfully unsubscribed from push notifications',
            subscription: result.rows[0]
        };

    } catch (error) {
        console.error('Error in unsubscribeFromPush:', error);
        throw error;
    }
};

/**
 * Get user's active push subscriptions
 * @param {number} userId - User ID
 * @param {number} adminId - Admin ID
 * @param {string} userType - 'user' or 'admin'
 * @returns {Promise<Array>} - List of active subscriptions
 */
export const getUserSubscriptions = async (userId, adminId, userType) => {
    try {
        const query = `
            SELECT *
            FROM push_subscriptions
            WHERE ${userType === 'user' ? 'user_id = $1' : 'admin_id = $1'}
              AND is_active = TRUE
            ORDER BY created_at DESC
        `;
        
        const result = await SQLquery(query, [userType === 'user' ? userId : adminId]);

        return {
            success: true,
            subscriptions: result.rows
        };

    } catch (error) {
        console.error('Error in getUserSubscriptions:', error);
        throw error;
    }
};

/**
 * Send push notification to a specific subscription
 * @param {Object} subscription - Subscription object from database
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} - Send result
 */
export const sendPushToSubscription = async (subscription, payload) => {
    try {
        const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.p256dh_key,
                auth: subscription.auth_key
            }
        };

        const notificationPayload = JSON.stringify(payload);

        await webPush.sendNotification(pushSubscription, notificationPayload);

        // Update last_used timestamp
        await SQLquery(
            'UPDATE push_subscriptions SET last_used = NOW() WHERE subscription_id = $1',
            [subscription.subscription_id]
        );

        return {
            success: true,
            message: 'Push notification sent successfully'
        };

    } catch (error) {
        console.error('Error sending push notification:', error);

        // Handle expired or invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription is no longer valid, deactivate it
            await SQLquery(
                'UPDATE push_subscriptions SET is_active = FALSE WHERE subscription_id = $1',
                [subscription.subscription_id]
            );
            
            return {
                success: false,
                message: 'Subscription expired or invalid, deactivated',
                error: error.message
            };
        }

        throw error;
    }
};

/**
 * Send push notification to specific user or admin
 * @param {Object} params - { userId, adminId, userType, notificationData }
 * @returns {Promise<Object>} - Send results
 */
export const sendPushNotification = async (params) => {
    try {
        const { userId, adminId, userType, notificationData } = params;

        // Get user's active subscriptions
        const subscriptionsResult = await getUserSubscriptions(userId, adminId, userType);
        const subscriptions = subscriptionsResult.subscriptions;

        if (subscriptions.length === 0) {
            return {
                success: false,
                message: 'No active push subscriptions found',
                sentCount: 0
            };
        }

        // Send to all active subscriptions
        const results = await Promise.allSettled(
            subscriptions.map(sub => sendPushToSubscription(sub, notificationData))
        );

        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failedCount = results.length - successCount;

        return {
            success: true,
            message: `Push notifications sent`,
            sentCount: successCount,
            failedCount: failedCount,
            totalSubscriptions: subscriptions.length
        };

    } catch (error) {
        console.error('Error in sendPushNotification:', error);
        throw error;
    }
};

/**
 * Send push notification for inventory alert to appropriate users
 * Based on alert type and user roles (similar to notificationServices.js logic)
 * @param {Object} alert - Alert object from Inventory_Alerts table
 * @returns {Promise<Object>} - Send results
 */
export const sendAlertPushNotification = async (alert) => {
    try {
        const { alert_id, alert_type, message, product_id, branch_id, banner_color } = alert;

        // Prepare notification payload
        const notificationPayload = {
            title: alert_type || 'Inventory Alert',
            body: message,
            icon: '/icon-192x192.png', // Add your app icon path
            badge: '/badge-72x72.png', // Add your badge icon path
            tag: `alert-${alert_id}`,
            data: {
                alert_id,
                alert_type,
                product_id,
                branch_id,
                banner_color,
                url: `/notifications`, // URL to open when notification is clicked
                timestamp: dayjs().toISOString()
            },
            requireInteraction: banner_color === 'red', // Require user action for critical alerts
            vibrate: [200, 100, 200] // Vibration pattern
        };

        // Get users who should receive this notification (from user_notification table)
        const userQuery = `
            SELECT DISTINCT un.user_id
            FROM user_notification un
            WHERE un.alert_id = $1
        `;
        const userResult = await SQLquery(userQuery, [alert_id]);

        // Get admins who should receive this notification (from admin_notification table)
        const adminQuery = `
            SELECT DISTINCT an.admin_id
            FROM admin_notification an
            WHERE an.alert_id = $1
        `;
        const adminResult = await SQLquery(adminQuery, [alert_id]);

        // Send to all users
        const userPromises = userResult.rows.map(row =>
            sendPushNotification({
                userId: row.user_id,
                userType: 'user',
                notificationData: notificationPayload
            })
        );

        // Send to all admins
        const adminPromises = adminResult.rows.map(row =>
            sendPushNotification({
                adminId: row.admin_id,
                userType: 'admin',
                notificationData: notificationPayload
            })
        );

        const allResults = await Promise.allSettled([...userPromises, ...adminPromises]);

        const totalSent = allResults.reduce((sum, result) => {
            if (result.status === 'fulfilled' && result.value.success) {
                return sum + (result.value.sentCount || 0);
            }
            return sum;
        }, 0);

        return {
            success: true,
            message: 'Alert push notifications sent',
            sentCount: totalSent,
            userCount: userResult.rows.length,
            adminCount: adminResult.rows.length
        };

    } catch (error) {
        console.error('Error in sendAlertPushNotification:', error);
        throw error;
    }
};

/**
 * Get VAPID public key for client-side subscription
 * @returns {string} - VAPID public key
 */
export const getVapidPublicKey = () => {
    // Get fresh value from environment (in case module was loaded before env vars)
    const currentKey = process.env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY;
    
    console.log('[getVapidPublicKey] Called');
    console.log('[getVapidPublicKey] process.env.VAPID_PUBLIC_KEY exists:', !!process.env.VAPID_PUBLIC_KEY);
    console.log('[getVapidPublicKey] VAPID_PUBLIC_KEY constant:', VAPID_PUBLIC_KEY?.substring(0, 20) + '...');
    console.log('[getVapidPublicKey] currentKey:', currentKey?.substring(0, 20) + '...');
    
    if (!currentKey || currentKey === 'YOUR_PUBLIC_KEY_HERE' || currentKey.length < 50) {
        const error = new Error('VAPID public key not configured. Please set VAPID_PUBLIC_KEY in environment variables.');
        console.error('[getVapidPublicKey]', error.message);
        console.error('[getVapidPublicKey] Debugging info:');
        console.error('  - process.env.VAPID_PUBLIC_KEY:', process.env.VAPID_PUBLIC_KEY);
        console.error('  - VAPID_PUBLIC_KEY constant:', VAPID_PUBLIC_KEY);
        console.error('  - currentKey:', currentKey);
        throw error;
    }
    
    console.log('[getVapidPublicKey] ✅ Returning valid key');
    return currentKey;
};

/**
 * Clean up expired and inactive subscriptions (can be run as a cron job)
 * @param {number} daysInactive - Days of inactivity before removal (default: 90)
 * @returns {Promise<Object>} - Cleanup results
 */
export const cleanupInactiveSubscriptions = async (daysInactive = 90) => {
    try {
        const cutoffDate = dayjs().subtract(daysInactive, 'day').toISOString();

        const query = `
            DELETE FROM push_subscriptions
            WHERE is_active = FALSE 
               OR last_used < $1
            RETURNING subscription_id
        `;

        const result = await SQLquery(query, [cutoffDate]);

        return {
            success: true,
            message: `Cleaned up ${result.rows.length} inactive subscriptions`,
            removedCount: result.rows.length
        };

    } catch (error) {
        console.error('Error in cleanupInactiveSubscriptions:', error);
        throw error;
    }
};
