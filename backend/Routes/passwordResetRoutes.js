import express from 'express';
import * as passwordResetController from '../Controllers/passwordResetController.js';

const router = express.Router();

// REQUEST PASSWORD RESET (SEND EMAIL)
router.post('/password-reset/request', passwordResetController.requestPasswordReset);

// VERIFY RESET TOKEN
router.get('/password-reset/verify/:token', passwordResetController.verifyResetToken);

// RESET PASSWORD
router.post('/password-reset/reset', passwordResetController.resetPassword);

// TEST EMAIL CONNECTION (FOR DEBUGGING)
router.get('/password-reset/test-email', passwordResetController.testEmail);

// CLEANUP EXPIRED TOKENS (ADMIN ENDPOINT)
router.delete('/password-reset/cleanup', passwordResetController.cleanupTokens);

export default router;