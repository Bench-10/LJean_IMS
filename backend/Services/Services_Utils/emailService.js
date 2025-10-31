import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// CREATE EMAIL TRANSPORTER
const createTransporter = () => {
    return nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
};

// SEND PASSWORD RESET EMAIL
export const sendPasswordResetEmail = async (email, resetToken, userType, firstName = '') => {
    try {
        const transporter = createTransporter();
        
        const resetUrl = `${'http://192.168.1.30:3000'}/reset-password?token=${resetToken}&type=${userType}`;
        
        const mailOptions = {
            from: {
                name: process.env.EMAIL_FROM_NAME || 'L-Jean Trading System',
                address: process.env.EMAIL_USER
            },
            to: email,
            subject: 'Password Reset Request - L-Jean Trading System',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 30px;">


                            <h1 style="color: #059669; margin-bottom: 10px;">L-Jean Trading System</h1>

                            <h2 style="color: #065f46; margin: 0;">Password Reset Request</h2>

                        </div>

                        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin: 0 0 15px 0; color: #374151;">


                            ${firstName ? `Hello ${firstName},` : 'Hello,'}


                        </p>
                        <p style="margin: 0 0 15px 0; color: #374151;">

                            We received a request to reset your password for your L-Jean Trading System account.

                        </p>


                        <p style="margin: 0; color: #374151;">
                            Click the button below to reset your password:
                        </p>

                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">


                        <a href="${resetUrl}" 
                           style="background-color: #059669; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 6px; display: inline-block;
                                  font-weight: bold;">
                            Reset Password
                            
                        </a>

                    </div>

                    
                    <div style="background-color: #ecfdf5; padding: 15px; border-radius: 6px; margin-bottom: 20px;">

                        <p style="margin: 0; color: #14532d; font-size: 14px;">

                            <strong>Important:</strong> This link will expire in 1 hour for security reasons.
                        </p>
                    </div>
                    
                    <div style="border-top: 1px solid #d1fae5; padding-top: 20px; margin-top: 30px;">

                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                            If you didn't request this password reset, please ignore this email.
                        </p>

                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">

                            If the button doesn't work, copy and paste this link into your browser:
                        </p>
                        <p style="margin: 0; color: #059669; font-size: 12px; word-break: break-all;">
                            ${resetUrl}
                        </p>

                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">

                            © ${new Date().getFullYear()} L-Jean Trading System. All rights reserved.
                        </p>

                    </div>

                </div>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Password reset email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
        
    } catch (error) {
        console.error('❌ Failed to send password reset email:', error);
        return { success: false, error: error.message };
    }
};

// TEST EMAIL CONNECTION
export const testEmailConnection = async () => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        console.log('✅ Email service connection successful');
        return { success: true, message: 'Email service connection successful' };
    } catch (error) {
        console.error('❌ Email service connection failed:', error);
        return { success: false, error: error.message };
    }
};