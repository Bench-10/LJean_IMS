import { SQLquery } from "../../db.js";
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../Services_Utils/emailService.js';
import { saltHashPassword } from "../Services_Utils/passwordHashing.js";
import { encryptPassword } from "../Services_Utils/passwordEncryption.js";

// GENERATE SECURE RANDOM TOKEN
const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// REQUEST PASSWORD RESET (SEND EMAIL)
export const requestPasswordReset = async (email, userType = 'user') => {
    try {
        let userQuery, userTable, userIdField, nameField;
        
        // DETERMINE WHICH TABLE TO CHECK BASED ON USER TYPE
        if (userType === 'admin') {
            userQuery = `SELECT admin_id, username, first_name, last_name FROM Administrator WHERE username = $1`;
            userTable = 'Administrator';
            userIdField = 'admin_id';
            nameField = 'first_name';
        } else {
            userQuery = `
                SELECT u.user_id, lc.username, u.first_name, u.last_name 
                FROM Users u 
                JOIN Login_Credentials lc ON u.user_id = lc.user_id 
                WHERE lc.username = $1
            `;
            userTable = 'Users';
            userIdField = 'user_id';
            nameField = 'first_name';
        }

        // CHECK IF USER EXISTS
        const { rows: users } = await SQLquery(userQuery, [email]);
        
        if (users.length === 0) {
            return { 
                success: false, 
                message: 'No account found with this email address.',
                code: 'USER_NOT_FOUND'
            };
        }

        const user = users[0];
        const userId = user[userIdField];
        const firstName = user[nameField];

        // GENERATE RESET TOKEN
        const resetToken = generateResetToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        await SQLquery('BEGIN');

        try {
            // DELETE ANY EXISTING TOKENS FOR THIS USER
            if (userType === 'admin') {
                await SQLquery(
                    `DELETE FROM password_reset_tokens WHERE admin_id = $1 AND user_type = $2`,
                    [userId, userType]
                );
            } else {
                await SQLquery(
                    `DELETE FROM password_reset_tokens WHERE user_id = $1 AND user_type = $2`,
                    [userId, userType]
                );
            }

            // INSERT NEW TOKEN
            const insertQuery = userType === 'admin' 
                ? `INSERT INTO password_reset_tokens (admin_id, user_type, token, email, expires_at) 
                   VALUES ($1, $2, $3, $4, $5) RETURNING id`
                : `INSERT INTO password_reset_tokens (user_id, user_type, token, email, expires_at) 
                   VALUES ($1, $2, $3, $4, $5) RETURNING id`;

            const { rows: tokenResult } = await SQLquery(insertQuery, [
                userId, userType, resetToken, email, expiresAt
            ]);

            // SEND EMAIL
            const emailResult = await sendPasswordResetEmail(email, resetToken, userType, firstName);
            
            if (!emailResult.success) {
                throw new Error(`Failed to send email: ${emailResult.error}`);
            }

            await SQLquery('COMMIT');

            console.log(`✅ Password reset requested successfully for ${userType}: ${email}`);
            
            return {
                success: true,
                message: 'Password reset email sent successfully. Please check your inbox.',
                tokenId: tokenResult[0].id,
                expiresAt: expiresAt
            };

        } catch (error) {
            await SQLquery('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('❌ Error requesting password reset:', error);
        return {
            success: false,
            message: 'An error occurred while processing your request. Please try again.',
            error: error.message
        };
    }
};

// VERIFY RESET TOKEN
export const verifyResetToken = async (token) => {
    try {
        const { rows: tokens } = await SQLquery(`
            SELECT 
                id, user_id, admin_id, user_type, email, expires_at, used
            FROM password_reset_tokens 
            WHERE token = $1
        `, [token]);

        if (tokens.length === 0) {
            return { 
                success: false, 
                message: 'Invalid reset token.',
                code: 'INVALID_TOKEN'
            };
        }

        const resetToken = tokens[0];

        if (resetToken.used) {
            return { 
                success: false, 
                message: 'This reset link has already been used.',
                code: 'TOKEN_USED'
            };
        }

        if (new Date() > new Date(resetToken.expires_at)) {
            return { 
                success: false, 
                message: 'This reset link has expired. Please request a new one.',
                code: 'TOKEN_EXPIRED'
            };
        }

        return { 
            success: true, 
            tokenData: resetToken 
        };

    } catch (error) {
        console.error('❌ Error verifying reset token:', error);
        return {
            success: false,
            message: 'An error occurred while verifying the reset token.',
            error: error.message
        };
    }
};

// RESET PASSWORD
export const resetPassword = async (token, newPassword) => {
    try {
        // VERIFY TOKEN FIRST
        const tokenVerification = await verifyResetToken(token);
        
        if (!tokenVerification.success) {
            return tokenVerification;
        }

        const { tokenData } = tokenVerification;
        const { user_id, admin_id, user_type, email } = tokenData;

        // HASH NEW PASSWORD
        let securePassword
        if (user_type === 'admin'){
            securePassword = await saltHashPassword(newPassword);
        } else {
            securePassword = await encryptPassword(newPassword);
        }

 

        await SQLquery('BEGIN');

        try {
            // UPDATE PASSWORD IN APPROPRIATE TABLE
            if (user_type === 'admin') {
                await SQLquery(
                    `UPDATE Administrator SET password = $1 WHERE admin_id = $2`,
                    [securePassword, admin_id]
                );
            } else {
                await SQLquery(
                    `UPDATE Login_Credentials SET password = $1 WHERE user_id = $2`,
                    [securePassword, user_id]
                );
            }

            // MARK TOKEN AS USED
            await SQLquery(
                `UPDATE password_reset_tokens 
                 SET used = true, used_at = NOW() 
                 WHERE token = $1`,
                [token]
            );

            await SQLquery('COMMIT');

            console.log(`✅ Password reset successfully for ${user_type}: ${email}`);

            return {
                success: true,
                message: 'Password has been reset successfully. You can now login with your new password.',
                userType: user_type
            };

        } catch (error) {
            await SQLquery('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('❌ Error resetting password:', error);
        return {
            success: false,
            message: 'An error occurred while resetting your password. Please try again.',
            error: error.message
        };
    }
};

// CLEANUP EXPIRED TOKENS (RUN PERIODICALLY)
export const cleanupExpiredTokens = async () => {
    try {
        const { rows: result } = await SQLquery(`
            DELETE FROM password_reset_tokens 
            WHERE expires_at < NOW() OR (used = true AND used_at < NOW() - INTERVAL '24 hours')
            RETURNING id
        `);

        console.log(`🧹 Cleaned up ${result.length} expired password reset tokens`);
        return { success: true, cleanedCount: result.length };

    } catch (error) {
        console.error('❌ Error cleaning up expired tokens:', error);
        return { success: false, error: error.message };
    }
};