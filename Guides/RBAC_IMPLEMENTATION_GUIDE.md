# Role-Based Access Control (RBAC) Implementation Guide

## Quick Summary

- **Login response now sets an HTTP-only cookie** named `access_token`.
- **Frontend no longer handles JWT strings manually.** Axios is configured to send cookies automatically and redirect to login if the session expires.
- **Backend authentication middleware** reads the token from the cookie (or `Authorization` header fallback), re-checks the database, and attaches the fresh user record to `req.user`.
- Works for **both branch users and owners/admins** with the same flow.

---

## Backend Flow

1. **Login** (`POST /api/authentication`)
   - Credentials are validated with `userAuthentication.userAuth`.
   - `generateToken` signs a JWT containing `user_id`, `user_type`, `role`, and `branch_id`.
   - `userControllers.userCredentials` sets the cookie using `res.cookie()` with secure defaults provided by `getTokenCookieOptions()`.
   - Response body returns `{ user, expiresInMs }` (no JWT string is returned).

2. **Authenticated request**
   - `authenticate` middleware (in `backend/middleware/auth.js`) extracts the token from the cookie.
   - JWT is verified with `jsonwebtoken`; the latest user data is queried.
   - Disabled or inactive accounts are rejected (403).
   - `req.user` holds the trusted user/admin object for the rest of the pipeline.

3. **Authorization layer**
   - `requireRole(...roles)` ensures only allowed roles access an endpoint.
   - `requireOwnBranch` restricts branch-specific data to the user’s branch unless they are an owner/admin.

4. **Logout** (`PUT /api/authentication/:id`)
   - Updates activity tracking and clears the cookie with `res.clearCookie()`.

### Key backend files

- `backend/middleware/auth.js` — Cookie-aware authentication + role helpers.
- `backend/utils/authCookies.js` — Central place for the cookie name/options (SameSite, maxAge, etc.).
- `backend/utils/jwt.js` — Token signing + decoding helpers.
- `backend/Controllers/userControllers.js` — Handles login/logout and sets/clears cookies.
- `backend/server.js` — Registers `cookie-parser` globally.

---

## Frontend Flow

1. **Axios instance** (`frontend/src/utils/api.js`)
   - `withCredentials: true` makes the browser send the HTTP-only cookie automatically.
   - A response interceptor watches for `401` responses (except the login call), clears cached user info, and redirects to `/` (login).

2. **Authentication context** (`frontend/src/authentication/Authentication.jsx`)
   - `loginAuthentication` posts credentials, receives `{ user }`, stores it in React state + `localStorage` for UI usage.
   - No manual token storage is required.
   - `logout` still calls the backend endpoint so the cookie is cleared server-side.

3. **Protected routes** (`frontend/src/utils/RouteProtection.jsx`)
   - Rely on the context’s `user` and role array to guard navigation.

4. **UI components**
   - Continue consuming `useAuth()` for current user data; nothing else changes.

---

## Cookie Details

- **Name**: `access_token` (override with `JWT_COOKIE_NAME`).
- **Storage**: HTTP-only cookie (inaccessible to JavaScript) set for the entire site (`path: '/'`).
- **Security flags**:
  - `httpOnly: true` — mitigates XSS token theft.
  - `sameSite: 'lax'` (dev) / `'strict'` (prod) — prevents CSRF unless you deliberately relax it.
  - `secure: true` in production — only sent over HTTPS.
  - `maxAge` respects `JWT_COOKIE_MAX_AGE` or falls back to `JWT_EXPIRES_IN` (`8h` default).

> The backend still accepts `Authorization: Bearer <token>` for tooling/testing, but the browser path is now cookie-first.

---

## Adding Middleware to Routes (pattern refresher)

```javascript
import { authenticate, requireRole, requireOwnBranch } from '../middleware/auth.js';
import { writeOperationLimiter } from '../middleware/rateLimiters.js';

router.post(
  '/items',
  authenticate,
  requireRole('Inventory Staff', 'Branch Manager', 'Owner'),
  writeOperationLimiter,
  itemControllers.addItem
);

router.get(
  '/branch-sales',
  authenticate,
  requireOwnBranch,
  saleControllers.getBranchSales
);
```

Order matters: `authenticate → requireRole/requireOwnBranch → rate limiter → controller`.

---

## Manual Testing Cheatsheet

```bash
# 1. Login (store cookie jar).
curl -i \
  -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"Secret123"}' \
  http://localhost:5000/api/authentication

# 2. Hit an authenticated endpoint using the saved cookie.
curl -i \
  -b cookies.txt \
  http://localhost:5000/api/items

# 3. Logout (clears cookie server-side).
curl -i \
  -X PUT \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"activity": false}' \
  http://localhost:5000/api/authentication/123
```

For Postman/Thunder Client, enable *"Automatically follow redirects"* and *"Retain cookies"*.

---

## Environment Variables

Add these if they are not present already:

```
JWT_SECRET=super-secret-value-change-me
JWT_EXPIRES_IN=8h
# Optional overrides:
# JWT_COOKIE_NAME=ljean_session
# JWT_COOKIE_MAX_AGE=8h
```

- `JWT_EXPIRES_IN` supports formats like `30m`, `8h`, `7d`, or raw milliseconds.
- `JWT_COOKIE_MAX_AGE` (if set) wins over `JWT_EXPIRES_IN` for cookie lifetime.

---

## Troubleshooting

- **401: Authentication required**
  - Cookie missing or expired. Have the user log in again.
  - Ensure frontend requests use the shared Axios instance so `withCredentials` stays enabled.

- **403: Forbidden**
  - User lacks the role required by `requireRole` or tries to access another branch without `Owner`/`admin` privileges.

- **Cookie not set in browser**
  - Check CORS: `CORS_ORIGIN` must include your frontend URL and `credentials: true` is required (already configured).
  - For HTTPS-only deployments, cookies need `secure: true` — ensure you are visiting the HTTPS version of the site in production.

- **Local development still sees old tokens**
  - Clear cookies for `localhost` in your browser dev tools.
  - Restart the dev server after changing `.env.*` values.

---

## Next Steps

1. Roll the same `authenticate/requireRole` chain onto the remaining routes (`saleRoutes`, `deliveryRoutes`, `analyticsRoutes`, etc.).
2. Harden the admin/owner-specific endpoints with precise role lists.
3. Consider adding a lightweight `GET /api/session` endpoint to fetch `req.user` directly when the app mounts.
4. When moving to production, serve everything behind HTTPS so the secure cookie flag works as intended.
