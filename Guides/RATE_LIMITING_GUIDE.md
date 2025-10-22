# Rate Limiting & Security Implementation Guide

## Overview

The backend now implements comprehensive rate limiting and throttling to protect against brute-force attacks, DDoS attempts, and abuse. This guide explains the different limiters and how they work.

## Rate Limiting Layers

### 1. Soft Throttling (Speed Limiter)
- **Applied to**: All `/api` routes
- **Window**: 15 minutes
- **Behavior**: Gradually slows down requests after 30 requests
  - First 30 requests: Full speed
  - After 30: Adds 100ms delay per additional request
  - Maximum delay: 5 seconds
- **Purpose**: Gentle warning before hard blocking

### 2. Global API Limiter
- **Applied to**: All `/api` routes
- **Window**: 15 minutes (configurable via `RATE_LIMIT_WINDOW_MINUTES`)
- **Max Requests**: 300 (configurable via `RATE_LIMIT_MAX`)
- **Behavior**: Hard block with 429 status after limit exceeded
- **Purpose**: Baseline protection for all endpoints

### 3. Login Limiter (Strict)
- **Applied to**: `/api/authentication`
- **Window**: 15 minutes
- **Max Attempts**: 5
- **Key**: `login:{username}:{ip}` (prevents account enumeration)
- **Skip successful**: Yes (doesn't count successful logins)
- **Message**: "Too many login attempts. Please try again after 15 minutes."
- **Purpose**: Prevent credential stuffing and brute-force attacks

### 4. Password Reset Limiter (Very Strict)
- **Applied to**: 
  - `/api/password-reset/request`
  - `/api/password-reset/verify/:token`
  - `/api/password-reset/reset`
- **Window**: 1 hour
- **Max Attempts**: 3
- **Key**: `reset:{email}:{ip}`
- **Message**: "Too many password reset requests. Please try again after 1 hour."
- **Purpose**: Prevent email bombing and reset token enumeration

### 5. Account Creation Limiter
- **Applied to**: `/api/create_account`
- **Window**: 1 hour
- **Max Attempts**: 3 per IP
- **Message**: "Too many account creation attempts. Please try again later."
- **Purpose**: Prevent spam account creation

### 6. Write Operation Limiter
- **Applied to**: All POST, PUT, PATCH, DELETE operations on:
  - `/api/items` (add, update, approve, reject)
  - `/api/categories` (add, update)
  - `/api/sale` (add sale)
  - `/api/delivery` (add, update)
- **Window**: 15 minutes
- **Max Requests**: 100
- **Skips**: GET requests
- **Message**: "Too many write operations. Please slow down."
- **Purpose**: Prevent data manipulation abuse

## Compression Configuration

The server now uses intelligent compression:
- **Threshold**: Only compress responses > 1KB
- **Level**: Best speed (fast compression)
- **Filters**: Skips already-compressed formats (images, videos, PDFs, archives)
- **Purpose**: Reduce bandwidth without CPU overhead on binary content

## Environment Variables

Add these to your `.env.development` and `.env.production`:

```bash
# Rate limiting
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_MAX=300

# For stricter production settings
# RATE_LIMIT_MAX=120
```

## Testing Rate Limits

### Test Login Limiter
```bash
# Try 6 login attempts quickly (PowerShell)
1..6 | ForEach-Object {
  Invoke-RestMethod -Uri "http://localhost:3000/api/authentication" `
    -Method Post `
    -Body (@{username="test"; password="wrong"} | ConvertTo-Json) `
    -ContentType "application/json" `
    -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 100
}
# 6th request should return 429
```

### Test Password Reset Limiter
```bash
# Try 4 reset requests quickly
1..4 | ForEach-Object {
  Invoke-RestMethod -Uri "http://localhost:3000/api/password-reset/request" `
    -Method Post `
    -Body (@{email="test@example.com"} | ConvertTo-Json) `
    -ContentType "application/json" `
    -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 100
}
# 4th request should return 429
```

### Check Rate Limit Headers
Every response includes:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests left in current window
- `RateLimit-Reset`: Time when limit resets (Unix timestamp)

## Production Recommendations

### 1. Use Redis Store (Multi-Instance Deployments)
For PM2 cluster mode or multiple servers, use Redis to share rate limit state:

```javascript
// In server.js (add these imports)
import Redis from 'ioredis';
import RedisStore from 'rate-limit-redis';

// Create Redis client
const redisClient = new Redis(process.env.REDIS_URL);

// Use in limiters
const loginLimiter = rateLimit({
  // ...existing config...
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args)
  })
});
```

Add to `.env.production`:
```bash
REDIS_URL=redis://localhost:6379
```

### 2. Monitor & Alert
- Log all 429 responses to your monitoring system
- Set alerts for unusual spike patterns
- Track which endpoints are being rate-limited most

### 3. Adjust Limits Based on Traffic
- Start conservative (current values)
- Monitor legitimate user patterns
- Increase limits gradually if needed
- Keep auth endpoints strict

### 4. Consider IP Whitelisting
For known trusted IPs (office, CI/CD), skip rate limiting:

```javascript
const apiLimiter = rateLimit({
  // ...existing config...
  skip: (req) => {
    const trustedIPs = (process.env.TRUSTED_IPS || '').split(',');
    return trustedIPs.includes(req.ip);
  }
});
```

### 5. Add CAPTCHA for Repeated Failures
After hitting login rate limit, require CAPTCHA verification before allowing more attempts.

## Security Best Practices

1. **Never disable rate limiting in production**
2. **Keep `trust proxy` enabled only in production** (already configured)
3. **Monitor rate limit violations** - high volumes may indicate attacks
4. **Combine with other security measures**:
   - Account lockout after N failed attempts
   - CAPTCHA on sensitive forms
   - IP reputation checking
   - Anomaly detection

## Troubleshooting

### Rate Limit Not Working
1. Check `NODE_ENV` is set correctly
2. Verify `trust proxy` setting matches your deployment
3. Confirm middleware order (rate limiters before routes)
4. Check if IP is being read correctly: `console.log(req.ip)`

### Legitimate Users Being Blocked
1. Review limits - may need to increase
2. Check if key generator is correct (username vs IP)
3. Consider per-user limits instead of per-IP for authenticated routes
4. Whitelist known IPs if appropriate

### Rate Limit Headers Not Showing
1. Ensure `standardHeaders: true` in limiter config
2. Check CORS allows headers to be exposed
3. Verify middleware is actually running (add console.log)

## Next Steps

- [ ] Install `express-slow-down` package: `npm install express-slow-down`
- [ ] Test all rate-limited endpoints
- [ ] Monitor logs for 429 responses
- [ ] Set up Redis for production (multi-instance)
- [ ] Configure monitoring/alerting
- [ ] Document limits for frontend team
- [ ] Add user-facing rate limit messages in UI
