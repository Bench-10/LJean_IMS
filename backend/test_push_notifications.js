/**
 * Test Script for Web Push Notification Backend
 * 
 * This script tests the push notification service functions
 * Run with: node backend/test_push_notifications.js
 */

import { 
    getVapidPublicKey,
    subscribeToPush,
    getUserSubscriptions,
    unsubscribeFromPush
} from './Services/pushNotificationService.js';

console.log('🧪 Testing Web Push Notification Service\n');

// Test 1: Get VAPID Public Key
console.log('Test 1: Get VAPID Public Key');
try {
    const publicKey = getVapidPublicKey();
    console.log('✅ Public Key:', publicKey.substring(0, 20) + '...');
    console.log('   Length:', publicKey.length, 'characters\n');
} catch (error) {
    console.error('❌ Failed:', error.message, '\n');
}

// Test 2: Subscribe to Push (Mock)
console.log('Test 2: Subscribe to Push (Mock Data)');
const mockSubscription = {
    userId: 1,
    userType: 'user',
    subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-' + Date.now(),
        keys: {
            p256dh: 'mock-p256dh-key-' + Date.now(),
            auth: 'mock-auth-key-' + Date.now()
        }
    },
    deviceInfo: {
        userAgent: 'Test Script',
        deviceName: 'Test Device'
    }
};

subscribeToPush(mockSubscription)
    .then(result => {
        console.log('✅ Subscription created successfully');
        console.log('   Subscription ID:', result.subscription.subscription_id);
        console.log('   User ID:', result.subscription.user_id);
        console.log('   Device:', result.subscription.device_name, '\n');
        
        // Test 3: Get User Subscriptions
        console.log('Test 3: Get User Subscriptions');
        return getUserSubscriptions(mockSubscription.userId, null, 'user');
    })
    .then(result => {
        console.log('✅ Retrieved subscriptions successfully');
        console.log('   Total subscriptions:', result.subscriptions.length);
        if (result.subscriptions.length > 0) {
            console.log('   Latest subscription:', result.subscriptions[0].device_name, '\n');
        }
        
        // Test 4: Unsubscribe
        console.log('Test 4: Unsubscribe from Push');
        return unsubscribeFromPush(mockSubscription.subscription.endpoint);
    })
    .then(result => {
        console.log('✅ Unsubscribed successfully');
        console.log('   Status:', result.success);
        console.log('   Message:', result.message, '\n');
        
        console.log('🎉 All tests completed!\n');
        console.log('Backend push notification service is working correctly.');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Test failed:', error.message);
        console.error('   Stack:', error.stack);
        process.exit(1);
    });
