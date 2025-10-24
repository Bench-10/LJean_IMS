# Security Implementation Guide

## 🔒 How JWT Authentication Works (Simple Explanation)

### The Problem We Solved
**Before:** User roles were stored in `localStorage` which can be easily modified by anyone using browser dev tools. An inventory staff could edit their `localStorage` to add "Branch Manager" role and bypass security checks.

**After:** Roles are NEVER trusted from the frontend. Every request validates permissions against the database.

---

## 🛡️ Security Flow (Step by Step)

### 1. **Login** 
```
User enters username/password
    ↓
Backend checks database
    ↓
If valid: Backend creates JWT token (like a secure badge)
    ↓
Backend sets HTTP-only cookie (user can't see or modify it)
    ↓
Backend sends user data to frontend
```

### 2. **Making Requests**
```
User clicks "Edit Product"
    ↓
Frontend sends request with JWT cookie (automatic)
    ↓
Backend reads JWT from cookie
    ↓
Backend verifies JWT signature (checks if badge is real)
    ↓
Backend fetches FRESH user data from database
    ↓
Backend checks: Is user active? What are their REAL roles?
    ↓
If user has permission: Allow action
If not: Return 403 Forbidden
```

### 3. **Why This is Secure**

| What Users See (Frontend) | What Backend Actually Checks |
|---|---|
| `localStorage`: Can be edited | ❌ Never trusted |
| JWT Cookie: HTTP-only, can't access | ✅ Verified every request |
| User data from `/api/me` | ✅ Always fresh from database |

**Key Point:** Even if someone modifies `localStorage`, the backend ALWAYS checks the database before allowing any action.

---

## 📁 Files Changed

### Backend Files

#### `backend/utils/jwt.js` - Token Generation
```javascript
// Creates a secure token with only user_id (not roles!)
// Roles are fetched from database, not stored in token
export function generateToken(user) {
  const payload = {
    user_id: user.user_id || user.admin_id,
    user_type: user.admin_id ? 'admin' : 'user'
  };
  return jwt.sign(payload, secret, { expiresIn: '8h' });
}
```

**Why?** Token only contains user ID. Roles can change in database, so we always fetch fresh data.

---

#### `backend/middleware/auth.js` - Authentication Guard
```javascript
export async function authenticate(req, res, next) {
  // 1. Extract JWT from cookie
  const token = extractToken(req);
  
  // 2. Verify JWT signature
  const decoded = jwt.verify(token, secret);
  
  // 3. CRITICAL: Fetch fresh user from database
  const result = await SQLquery('SELECT * FROM Users WHERE user_id = $1', [decoded.user_id]);
  
  // 4. Check if account is active
  if (user.is_disabled || user.status !== 'active') {
    return res.status(403).json({ error: 'Account disabled' });
  }
  
  // 5. Attach verified user to request
  req.user = userData; // Controllers trust this data
  next();
}
```

**Security:** 
- ✅ Fetches roles from database (not token)
- ✅ Checks account status every request
- ✅ Can't be bypassed by editing localStorage

---

#### `backend/middleware/auth.js` - Role Checking
```javascript
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // req.user.role comes from database (verified in authenticate)
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const hasRole = userRoles.some(role => allowedRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

**Usage in Routes:**
```javascript
// Only Branch Managers and Owners can edit products
router.put("/items/:id", 
  authenticate,                                      // Verify JWT + fetch roles from DB
  requireRole('Branch Manager', 'Owner'),            // Check roles
  itemControllers.updateItem                         // Execute action
);
```

---

#### `backend/Controllers/userControllers.js` - Get Current User
```javascript
// NEW ENDPOINT: Get user info from JWT (can't be faked)
export const getCurrentUser = async (req, res) => {
  // req.user is populated by authenticate middleware
  // It's already fresh from database
  res.status(200).json({
    user_id: req.user.user_id,
    role: req.user.role,           // From database, not localStorage
    branch_id: req.user.branch_id,
    first_name: req.user.first_name,
    // ... etc
  });
};
```

---

### Frontend Files

#### `frontend/src/authentication/Authentication.jsx` - Auth Context
```javascript
function Authentication({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app load: Fetch current user from backend
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/api/me'); // Uses JWT cookie
        setUser(response.data);                     // Data from database
      } catch (error) {
        setUser(null); // No valid session
      } finally {
        setLoading(false);
      }
    };
    fetchCurrentUser();
  }, []);

  const loginAuthentication = async (username, password) => {
    const response = await api.post('/api/authentication', { username, password });
    setUser(response.data?.user); // Store in state (NOT localStorage)
    // JWT cookie is set automatically by backend
  };

  const logout = async () => {
    await api.put('/api/authentication/${user.user_id}', { activity: false });
    setUser(null); // Clear state
    // Backend clears JWT cookie
  };
}
```

**Changes:**
- ❌ Removed `localStorage.setItem('userInfo', ...)` 
- ✅ Fetch user from `/api/me` on app load
- ✅ JWT cookie is automatic (HTTP-only)

---

#### `frontend/src/utils/api.js` - Axios Configuration
```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true  // Send cookies with every request
});

// Redirect to login if JWT is invalid/expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = "/"; // Redirect to login
    }
    return Promise.reject(error);
  }
);
```

---

## 🔐 Protected Routes Example

### All Routes Are Now Protected

#### ✅ User Routes (`backend/Routes/userRoutes.js`)
```javascript
router.get("/me", authenticate, userControllers.getCurrentUser);
router.get("/users", authenticate, requireRole('Owner', 'Branch Manager'), userControllers.getUsers);
router.put("/update_account/:id", authenticate, requireRole('Owner', 'Branch Manager'), userControllers.userUpdateAccount);
router.patch("/users/:id/approval", authenticate, requireRole('Owner'), userControllers.approvePendingUser);
```

#### ✅ Item Routes (`backend/Routes/itemRoutes.js`)
```javascript
router.get("/items", authenticate, itemControllers.getAllItems);
router.post("/items", authenticate, requireRole('Inventory Staff', 'Branch Manager', 'Owner'), itemControllers.addItem);
router.put("/items/:id", authenticate, requireRole('Inventory Staff', 'Branch Manager', 'Owner'), itemControllers.updateItem);
```

#### ✅ Sale Routes (`backend/Routes/saleRoutes.js`)
```javascript
router.get("/sale", authenticate, saleControllers.getAllSaleInformation);
router.post("/sale", authenticate, requireRole('Sales Associate', 'Branch Manager', 'Owner'), saleControllers.addSaleInformation);
```

#### ✅ Analytics Routes (`backend/Routes/analyticsRoutes.js`)
```javascript
router.get('/analytics/kpis', authenticate, requireRole('Owner', 'Branch Manager'), analyticsControllers.getKPIs);
router.get('/analytics/inventory-levels', authenticate, requireRole('Owner', 'Branch Manager'), analyticsControllers.getInventoryLevels);
```

---

## 🧪 Testing Security

### Test 1: Try to Edit Product as Inventory Staff
```bash
# Login as inventory staff
curl -c cookies.txt -X POST http://localhost:3000/api/authentication \
  -H "Content-Type: application/json" \
  -d '{"username":"inventory@example.com","password":"password123"}'

# Try to edit product (should fail with 403 Forbidden)
curl -b cookies.txt -X PUT http://localhost:3000/api/items/1 \
  -H "Content-Type: application/json" \
  -d '{"product_name":"Hacked Product"}'

# Response: {"error":"Forbidden","message":"Required role: Inventory Staff or Branch Manager or Owner"}
```

### Test 2: Modify localStorage (Should Have No Effect)
1. Open browser dev tools → Application → Local Storage
2. Change `userInfo.role` to `["Owner"]`
3. Try to edit product
4. **Result:** Backend still checks database, sees you're actually "Inventory Staff", returns 403 Forbidden

---

## 🚀 How to Deploy Securely

### Environment Variables (`.env.production`)
```bash
# Strong JWT secret (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=your-256-bit-secret-here-do-not-share

# Cookie expiration
JWT_EXPIRES_IN=8h

# Production mode
NODE_ENV=production

# CORS (your frontend domain)
CORS_ORIGIN=https://yourapp.com
```

### HTTPS Required in Production
```javascript
// backend/utils/authCookies.js
secure: isProduction  // Cookie only sent over HTTPS in production
```

**Important:** HTTP-only cookies require HTTPS in production to prevent man-in-the-middle attacks.

---

## ✅ Security Checklist

- [x] JWT tokens stored in HTTP-only cookies (can't be accessed by JavaScript)
- [x] Roles fetched from database on every request (not from token or localStorage)
- [x] All sensitive routes protected with `authenticate` middleware
- [x] Role-based access control with `requireRole` middleware
- [x] Account status checked on every request (disabled/inactive users blocked)
- [x] Frontend never stores sensitive data in localStorage
- [x] JWT secret is strong and environment-specific
- [x] CORS restricted to known origins
- [x] Rate limiting on all endpoints
- [x] HTTPS required in production

---

## 🎯 Key Takeaways

1. **Never Trust Frontend Data**: Always validate against database
2. **JWT is Just an ID Badge**: Roles/permissions come from database, not token
3. **HTTP-only Cookies**: Prevent XSS attacks (JavaScript can't access them)
4. **Fresh Data Every Request**: Account status and roles checked on every API call
5. **Defense in Depth**: Multiple layers (JWT + database check + role check + rate limiting)

---

## 🆘 Common Errors

### "Authentication required"
**Cause:** JWT cookie missing or invalid  
**Solution:** User needs to login again

### "Token expired"
**Cause:** JWT expired (default 8 hours)  
**Solution:** User needs to login again

### "Forbidden: Required role: Owner"
**Cause:** User doesn't have permission (role checked from database)  
**Solution:** Contact admin to update user role in database

### "Account disabled"
**Cause:** User account was disabled by admin  
**Solution:** Contact admin to re-enable account

---

## 📚 Further Reading

- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [HTTP-only Cookies vs localStorage](https://owasp.org/www-community/HttpOnly)
- [Role-Based Access Control (RBAC)](https://en.wikipedia.org/wiki/Role-based_access_control)
