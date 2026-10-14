Authentication uses two tokens with different storage:

- `accessToken`: JWT valid for 15 minutes, returned in the login JSON response and kept only in a frontend memory variable. Requests send `Authorization: Bearer <accessToken>`. It is not stored in cookies, Redis, MongoDB, localStorage or sessionStorage.
- `refreshToken`: JWT valid for 7 days by default (`REFRESH_TOKEN_TTL_SECONDS`), stored in an HttpOnly, SameSite=Strict cookie under `/api`. Its SHA-256 hash and user ID are stored in Redis with the same fixed TTL.

Every login creates a MongoDB `Session` document linked to the user and the refresh token's unique `refreshId`. It stores `deviceIp`, `internetIp`, `userAgent`, `expiresAt`, `revoked` (initially false), and `revokedAt` (initially null), plus timestamps. Session documents are kept after logout for history.

The login JSON response includes `accessToken`, `user` and `session`. `session.id` is the MongoDB session ID and is always present for a successful login. Session details include IPs, user agent, expiry, revocation status and timestamps. The refresh token stays in its HttpOnly cookie and is not included in the JSON response. Returning a session does not fill in an unknown device IP; `session.deviceIp` remains null unless supplied in the login body.

Every protected route must use `authMiddleware`. Access and refresh tokens check both the MongoDB session and Redis record. On later frontend requests, an expired or missing bearer access token causes the middleware to validate the refresh cookie, return a new access token in the `X-Access-Token` response header, and complete the same request. The frontend API helper reads that header and updates its memory variable. CORS exposes the header. A page reload clears frontend memory; the next protected request uses the refresh cookie to restore the access token. No intermediate 401 is sent. Refreshing does not extend the refresh token or session expiry. There is no separate refresh endpoint, frontend refresh function, or refresh timer. Authentication responses use `Cache-Control: no-store`.

Normal logout sets the current session's `revoked` field to true and records `revokedAt`. Logout-all sets these fields on every unrevoked session belonging to the authenticated account, including expired sessions. Already revoked sessions keep their original revocation time. Redis records are removed and the caller's cookies cleared. MongoDB revocation remains authoritative if Redis cleanup fails; all devices' old tokens are rejected on their next request. Other accounts are unaffected.

`deviceIp` is an optional client-reported IPv4/IPv6 address in the login body, for example `192.168.1.10`. Browsers cannot reliably expose their private LAN IP, so it defaults to null and is never trusted for authentication. `internetIp` is captured from `req.ip`, not the request body. It represents the network address observed by the backend; localhost development, NAT, VPNs or proxies affect this value. Forwarded IP headers are ignored by default. Behind a reverse proxy, set `TRUST_PROXY` to a comma-separated list of explicitly trusted proxy IPs/CIDRs. Configure the proxy to sanitize forwarded headers. `userAgent` comes from the request header and is limited to 512 characters.

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Register with name, email, password, confirmPassword |
| POST | `/api/auth/login` | Login with email, password and optional deviceIp; create a session, return accessToken and set the refresh cookie |
| GET | `/api/auth/me` | Get the current user; automatically refresh if needed |
| POST | `/api/auth/logout` | Revoke the current session, remove its Redis record, clear cookies |
| POST | `/api/auth/logout-all` | Revoke all sessions for the authenticated account, remove their Redis records, clear caller cookies |

Run MongoDB and Redis, configure `backend/.env` using `.env.example`, then run `npm start` in `backend`. `REDIS_URL` defaults to `redis://127.0.0.1:6379`. The existing `.env` has been updated with a separate random refresh secret. Keep secrets private and use HTTPS in production (`NODE_ENV=production`).

The frontend API helper is `frontend/src/api.js`; it sends cookies with each request. Call `authApi.logout()` for the current device or `authApi.logoutAll()` for every device. Vite proxies `/api` to port 3000. In production, route `/api` to the backend on the same site. No refresh interceptor or token storage in localStorage is needed.

In Postman, copy `accessToken` from the login response and use Authorization → Bearer Token for protected requests. Keep the refresh cookie in Postman's cookie jar for automatic renewal. After renewal, the new access token is in the `X-Access-Token` response header. Successful logout or logout-all clears the frontend memory variable; a 401 clears it too.

401 is returned for absent/expired/invalid refresh credentials, expired/revoked/missing sessions, revoked tokens, tampered access tokens, or invalid login credentials. Authentication storage outages return 503 and do not clear cookies. Users must sign in again after adding sessions because older token pairs have no session document.

Run `npm test` for HTTP authentication tests using real JWT and bcrypt operations with mocked MongoDB and Redis storage. A running MongoDB/Redis instance is needed for a live integration check.
