import jwt from 'jsonwebtoken';
import { SQLquery } from '../db.js';
import { getTokenCookieName, getTokenCookieOptions } from '../utils/authCookies.js';

/**
 * Extract JWT token from HTTP-only cookie or Authorization header
 * Cookie is preferred for security (HTTP-only prevents XSS)
 */
function extractToken(req) {
  // Check Authorization header first (for API clients)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check HTTP-only cookie (preferred for web browsers)
  const cookieName = getTokenCookieName();
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }

  return null;
}

/**\
 * Authentication middleware - VALIDATES EVERY REQUEST
 * 
 * Security flow:
 * 1. Extract JWT token from cookie/header
 * 2. Verify JWT signature and expiration
 * 3. Fetch FRESH user data from database (not from token!)
 * 4. Check if account is active/enabled
 * 5. Attach verified user to req.user
 * 
 * IMPORTANT: Never trust data from frontend localStorage/sessionStorage
 * Always fetch permissions from database on each request
 */

export async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const secret = process.env.JWT_SECRET || process.env.SECRET_KEY;
    if (!secret) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Verify JWT token (checks signature and expiration)
    const decoded = jwt.verify(token, secret);
    
    // CRITICAL: Fetch fresh user data from database
    // This ensures we have current roles/permissions, not stale token data
    let userData;
    if (decoded.user_type === 'admin') {
      const result = await SQLquery(
        'SELECT admin_id as id, username, role, first_name, last_name FROM Administrator WHERE admin_id = $1',
        [decoded.user_id]
      );
      if (!result.rows.length) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      userData = { ...result.rows[0], user_type: 'admin', admin_id: result.rows[0].id };
    } else {
      const result = await SQLquery(
        `SELECT u.user_id as id, u.role, u.first_name, u.last_name, u.branch_id, u.is_disabled, u.status
         FROM Users u
         WHERE u.user_id = $1`,
        [decoded.user_id]
      );
      
      if (!result.rows.length) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const user = result.rows[0];
      
      // Check if account is disabled or not active
      if (user.is_disabled) {
        return res.status(403).json({ error: 'Account disabled' });
      }
      if (user.status !== 'active') {
        return res.status(403).json({ error: 'Account not active' });
      }

      userData = { ...user, user_type: 'user', user_id: user.id };
    }

    // Attach verified user to request - controllers can trust this data
    req.user = userData;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const cookieName = getTokenCookieName();
      res.clearCookie(cookieName, getTokenCookieOptions());
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      const cookieName = getTokenCookieName();
      res.clearCookie(cookieName, getTokenCookieOptions());
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Role-based authorization middleware
 * Must be used AFTER authenticate middleware
 * 
 * @param {...string} allowedRoles - Roles that can access this endpoint
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const hasRole = userRoles.some(role => allowedRoles.some(allowed => allowed.toLowerCase() === role.toLowerCase()));

    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Required role: ${allowedRoles.join(' or ')}` 
      });
    }

    next();
  };
}

/**
 * Branch-scoped access control
 * Ensures users can only access their own branch data
 * Owners and Admins can access all branches
 */
export function requireOwnBranch(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Admin/Owner can access all branches
  const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
  if (userRoles.includes('Owner') || req.user.user_type === 'admin') {
    return next();
  }

  // Get branch_id from query, params, or body
  const requestedBranch = req.query.branch_id || req.params.branch_id || req.body.branch_id;
  
  if (requestedBranch && String(requestedBranch) !== String(req.user.branch_id)) {
    return res.status(403).json({ error: 'Access denied to this branch' });
  }

  next();
}
