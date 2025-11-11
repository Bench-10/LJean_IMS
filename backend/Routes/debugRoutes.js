import express from 'express';

const router = express.Router();

/**
 * Debug endpoint to check environment configuration
 * GET /api/debug/env
 * REMOVE THIS IN PRODUCTION - FOR DEBUGGING ONLY
 */
router.get('/env', (req, res) => {
    const envInfo = {
        nodeEnv: process.env.NODE_ENV || 'not set',
        vapidPublicKeyExists: !!process.env.VAPID_PUBLIC_KEY,
        vapidPublicKeyLength: process.env.VAPID_PUBLIC_KEY?.length || 0,
        vapidPublicKeyPreview: process.env.VAPID_PUBLIC_KEY?.substring(0, 20) + '...' || 'not set',
        vapidPrivateKeyExists: !!process.env.VAPID_PRIVATE_KEY,
        vapidPrivateKeyLength: process.env.VAPID_PRIVATE_KEY?.length || 0,
        vapidSubject: process.env.VAPID_SUBJECT || 'not set',
        allEnvKeys: Object.keys(process.env).filter(key => key.includes('VAPID'))
    };

    res.json({
        success: true,
        message: 'Environment configuration check',
        data: envInfo,
        warning: 'REMOVE THIS ENDPOINT IN PRODUCTION - Contains sensitive configuration info'
    });
});

export default router;
