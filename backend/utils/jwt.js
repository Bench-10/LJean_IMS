import jwt from 'jsonwebtoken';

/**
 * Generate JWT token for authenticated user
 * Token contains minimal user info - actual permissions are ALWAYS fetched from database
 * 
 * @param {Object} user - User object from database
 * @returns {String} JWT token
 */
export function generateToken(user) {
  const secret = process.env.JWT_SECRET || process.env.SECRET_KEY;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  const payload = {
    user_id: user.user_id || user.admin_id,
    user_type: user.admin_id ? 'admin' : 'user'
  };

  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  
  return jwt.sign(payload, secret, { expiresIn });
}
