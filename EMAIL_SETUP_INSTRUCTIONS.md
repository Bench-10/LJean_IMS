# Email Setup Instructions for Password Reset

## Overview
The password reset system has been implemented and is ready to use. You just need to configure the email settings to enable email sending functionality.

## Required Email Configuration

Add the following environment variables to your `.env` file (located in the root directory):

```env
# Email Configuration for Password Reset
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM_NAME=LJean Centralized System
FRONTEND_URL=http://localhost:5173
```

## Getting Gmail App Password

1. **Enable 2-Factor Authentication** on your Gmail account (if not already enabled)
2. **Generate an App Password**:
   - Go to your Google Account settings
   - Navigate to Security → App Passwords
   - Generate a new app password for "Mail"
   - Use this generated password (not your regular Gmail password) as `EMAIL_PASSWORD`

## Testing the Email Configuration

After adding the email configuration to your `.env` file, you can test it by:

1. **Start the backend server**:
   ```bash
   cd backend
   npm start
   ```

2. **Test the email connection**:
   - Make a GET request to: `http://localhost:3000/api/password-reset/test-email`
   - Or use the frontend to test by trying the "Forgot Password" feature

## How the Password Reset System Works

### Backend Features:
- **Email Service**: Sends HTML formatted reset emails
- **Token Generation**: Creates secure 6-digit tokens that expire in 1 hour
- **Database Integration**: Uses existing `password_reset_tokens` table
- **Security**: Tokens are hashed and have expiration times

### Frontend Features:
- **Forgot Password Form**: Allows users to enter email and select user type
- **Reset Password Form**: Validates tokens and allows new password entry
- **Integration**: Seamlessly integrated with existing login system

### Available API Endpoints:
- `POST /api/password-reset/request` - Request password reset
- `POST /api/password-reset/verify` - Verify reset token
- `POST /api/password-reset/reset` - Reset password with token
- `GET /api/password-reset/test-email` - Test email configuration

## Using the System

1. **Request Password Reset**:
   - Go to login page
   - Click "Forgot Password?"
   - Enter email and select user type (User/Admin)
   - Check email for reset token

2. **Reset Password**:
   - Click the link in the email or go to `/reset-password`
   - Enter the 6-digit token from email
   - Set new password
   - Login with new password

## Troubleshooting

### Email Not Sending:
- Check that Gmail app password is correct
- Verify 2FA is enabled on Gmail account
- Ensure EMAIL_SERVICE is set to "gmail"
- Test email connection endpoint

### Token Issues:
- Tokens expire after 1 hour
- Only one active token per user at a time
- Tokens are case-sensitive

### Frontend Routing:
- Ensure `/reset-password` route is accessible
- Check that ResetPassword component is properly imported

## File Structure Created

```
backend/
├── Services/
│   ├── Services_Utils/
│   │   └── emailService.js          # Email sending functionality
│   └── users/
│       └── passwordResetService.js   # Password reset logic
├── Controllers/
│   └── passwordResetController.js    # API endpoints
└── Routes/
    └── passwordResetRoutes.js        # Route definitions

frontend/
├── src/
│   ├── components/
│   │   └── auth/
│   │       ├── ForgotPassword.jsx    # Forgot password form
│   │       └── ResetPassword.jsx     # Reset password form
│   └── authentication/
│       └── Login.jsx                 # Updated with forgot password link
```

## Next Steps

1. **Configure Email**: Add the email settings to your `.env` file
2. **Test System**: Try the complete password reset flow
3. **Customize**: Modify email templates or styling as needed
4. **Deploy**: When deploying, update `FRONTEND_URL` to your production domain

The system is now fully implemented and ready for use!