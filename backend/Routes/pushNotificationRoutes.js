import express from 'express';
import {
    subscribe,
    unsubscribe,
    getSubscriptions,
    sendTestNotification,
    getPublicKey,
    cleanup
} from '../Controllers/pushNotificationController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Public route - get VAPID public key
router.get('/vapid-public-key', getPublicKey);

// Protected routes - require authentication
router.post('/subscribe', verifyToken, subscribe);
router.post('/unsubscribe', verifyToken, unsubscribe);
router.get('/subscriptions', verifyToken, getSubscriptions);
router.post('/test', verifyToken, sendTestNotification);
router.post('/cleanup', verifyToken, cleanup); // Admin only (checked in controller)

export default router;
