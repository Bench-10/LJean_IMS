# Environment Configuration

This project now looks for environment-specific configuration files so development and production values stay isolated. Use the steps below to keep secrets out of source control and avoid mixing settings between environments.

## Backend (`backend/`)

The Express server resolves environment files in this order:

1. `backend/.env.<NODE_ENV>` (e.g. `.env.development`, `.env.production`)
2. `.env.<NODE_ENV>` one directory up (for monorepo-wide values)
3. `backend/.env`
4. `../.env`

First match wins—later files only fill in values that are still missing. To set up cleanly:

1. Create `backend/.env.development` locally with non-production credentials.
2. Create `backend/.env.production` (or manage the same values as host-level env vars on the server).
3. Keep both files out of git (the top-level `.gitignore` already ignores `*.env*`).
4. When starting the server, set `NODE_ENV` so the correct file loads.

Example `backend/.env.development`:

```
NODE_ENV=development
PORT=5000
DATABASE_URL=postgres://local-user:local-pass@localhost:5432/ljean
JWT_SECRET=dev-super-secret
CORS_ORIGIN=http://localhost:5173
REQUEST_PAYLOAD_LIMIT=100kb
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_MAX=300
EMAIL_HOST=localhost
EMAIL_PORT=1025
EMAIL_USER=
EMAIL_PASSWORD=
```

Example `backend/.env.production`:

```
NODE_ENV=production
PORT=8080
DATABASE_URL=postgres://app-user:${PASSWORD}@prod-db:5432/ljean
JWT_SECRET=replace-with-strong-secret
CORS_ORIGIN=https://app.ljean.com,https://admin.ljean.com
REQUEST_PAYLOAD_LIMIT=200kb
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_MAX=120
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=465
EMAIL_USER=apikey
EMAIL_PASSWORD=${SENDGRID_KEY}
```

### Using DATABASE_URL (optional)

You can supply your database connection as a single `DATABASE_URL` instead of the individual `PG_*` variables. This is common on managed database providers (Heroku, Render, Railway, etc.). Example:

```
DATABASE_URL=postgres://username:password@host:5432/dbname
```

Notes:
- The server code will prefer `DATABASE_URL` when present. If `NODE_ENV=production` the pool will enable SSL with `rejectUnauthorized: false` by default to support common hosted DB setups. If you require strict certificate validation, provide a custom SSL configuration in your deployment.
- If `DATABASE_URL` is not present, the code falls back to the `PG_USER`, `PG_HOST`, `PG_DATABASE`, `PG_PASSWORD`, and `PG_PORT` variables shown earlier.
- Keep credentials out of version control; use host-level secrets or an untracked `.env.production` on the server.

> Tip: on Ubuntu/PM2, export the production vars or use an `.env.production` copy on the server. Start the app with `NODE_ENV=production pm2 start ecosystem.config.js` so the right file is loaded.

## Frontend (`frontend/`)

Vite automatically loads `.env`, `.env.local`, `.env.<mode>`, and `.env.<mode>.local` files. Only variables prefixed with `VITE_` are exposed to the browser.

Recommended structure:

- `frontend/.env.development`
- `frontend/.env.production`

Example `frontend/.env.development`:

```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_ENABLE_MOCK_DATA=false
```

Example `frontend/.env.production`:

```
VITE_API_BASE_URL=https://api.ljean.com/api
VITE_SOCKET_URL=https://api.ljean.com
VITE_ENABLE_MOCK_DATA=false
```

Local overrides should live in `.env.development.local` and stay untracked. During deployment, configure the host (e.g. Vercel, Netlify, container environment) with the production values or supply a `.env.production` alongside the build process.

## Operational Checklist

- [ ] Never commit actual secrets—only templates like `.env.example` or the snippets above.
- [ ] Ensure `NODE_ENV` is set correctly before starting backend or frontend builds.
- [ ] Update deployment scripts (`pm2`, CI/CD) to export the same variables so runtime matches the build.
- [ ] When adding new configuration keys, update both development and production files immediately to prevent runtime surprises.
