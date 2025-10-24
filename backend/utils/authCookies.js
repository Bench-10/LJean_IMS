/**
 * Cookie configuration for JWT authentication
 * Cookies are HTTP-only to prevent XSS attacks
 * Secure flag enabled in production for HTTPS-only transmission
 */

const MS_IN_SECOND = 1000;
const MS_IN_MINUTE = 60 * MS_IN_SECOND;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;
const MS_IN_DAY = 24 * MS_IN_HOUR;
const DEFAULT_MAX_AGE = 8 * MS_IN_HOUR;

const durationRegex = /^(\d+)([smhd])$/i;

function parseDuration(value) {
  if (!value) return DEFAULT_MAX_AGE;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed) * MS_IN_SECOND;
    }

    const match = durationRegex.exec(trimmed);
    if (!match) {
      return DEFAULT_MAX_AGE;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 's':
        return amount * MS_IN_SECOND;
      case 'm':
        return amount * MS_IN_MINUTE;
      case 'h':
        return amount * MS_IN_HOUR;
      case 'd':
        return amount * MS_IN_DAY;
      default:
        return DEFAULT_MAX_AGE;
    }
  }

  return DEFAULT_MAX_AGE;
}

export function getTokenCookieName() {
  return process.env.JWT_COOKIE_NAME || 'access_token';
}

export function getTokenCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = parseDuration(process.env.JWT_COOKIE_MAX_AGE || process.env.JWT_EXPIRES_IN);

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge,
    path: '/',
  };
}
