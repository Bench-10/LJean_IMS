import express from 'express';
import {
    subscribe,
    unsubscribe,
    getSubscriptions,
    sendTestNotification,
    getPublicKey,
    cleanup
} from '../Controllers/pushNotificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public route - get VAPID public key
router.get('/vapid-public-key', getPublicKey);

// Protected routes - require authentication
router.post('/subscribe', authenticate, subscribe);
router.post('/unsubscribe', authenticate, unsubscribe);
router.get('/subscriptions', authenticate, getSubscriptions);
router.post('/test', authenticate, sendTestNotification);
router.post('/cleanup', authenticate, cleanup); // Admin only (checked in controller)

export default router;
