import * as passwordResetService from '../Services/users/passwordResetService.js';
import { testEmailConnection } from '../Services/Services_Utils/emailService.js';

// REQUEST PASSWORD RESET
export const requestPasswordReset = async (req, res) => {
    try {
        const { email, userType = 'user' } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email address is required.'
            });
        }

        // VALIDATE EMAIL FORMAT
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address.'
            });
        }

        // VALIDATE USER TYPE
        if (!['user', 'admin'].includes(userType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user type.'
            });
        }

        console.log(`🔐 Password reset requested for: ${email} (${userType})`);

        const result = await passwordResetService.requestPasswordReset(email, userType);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: result.message
            });
        } else {
            const statusCode = result.code === 'USER_NOT_FOUND' ? 404 : 400;
            res.status(statusCode).json({
                success: false,
                message: result.message,
                code: result.code
            });
        }

    } catch (error) {
        console.error('❌ Error in requestPasswordReset controller:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
};

// VERIFY RESET TOKEN
export const verifyResetToken = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Reset token is required.'
            });
        }

        console.log(`🔍 Verifying reset token: ${token.substring(0, 8)}...`);

        const result = await passwordResetService.verifyResetToken(token);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Token is valid.',
                data: {
                    email: result.tokenData.email,
                    userType: result.tokenData.user_type,
                    expiresAt: result.tokenData.expires_at
                }
            });
        } else {
            const statusCode = result.code === 'INVALID_TOKEN' ? 404 : 400;
            res.status(statusCode).json({
                success: false,
                message: result.message,
                code: result.code
            });
        }

    } catch (error) {
        console.error('❌ Error in verifyResetToken controller:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Reset token and new password are required.'
            });
        }

        // VALIDATE PASSWORD STRENGTH
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        console.log(`🔄 Resetting password for token: ${token.substring(0, 8)}...`);

        const result = await passwordResetService.resetPassword(token, newPassword);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: result.message,
                userType: result.userType
            });
        } else {
            const statusCode = result.code === 'INVALID_TOKEN' ? 404 : 400;
            res.status(statusCode).json({
                success: false,
                message: result.message,
                code: result.code
            });
        }

    } catch (error) {
        console.error('❌ Error in resetPassword controller:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
};

// TEST EMAIL CONNECTION (FOR DEBUGGING)
export const testEmail = async (req, res) => {
    try {
        console.log('🧪 Testing email connection...');
        
        const result = await testEmailConnection();
        
        res.status(200).json({
            success: result.success,
            message: result.message || result.error
        });

    } catch (error) {
        console.error('❌ Error in testEmail controller:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
};

// CLEANUP EXPIRED TOKENS (ADMIN ENDPOINT)
export const cleanupTokens = async (req, res) => {
    try {
        console.log('🧹 Cleaning up expired password reset tokens...');
        
        const result = await passwordResetService.cleanupExpiredTokens();
        
        res.status(200).json({
            success: result.success,
            message: result.success 
                ? `Cleaned up ${result.cleanedCount} expired tokens` 
                : 'Failed to cleanup tokens',
            cleanedCount: result.cleanedCount || 0
        });

    } catch (error) {
        console.error('❌ Error in cleanupTokens controller:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
};