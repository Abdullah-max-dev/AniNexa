const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

process.env.JWT_SECRET = "test-access-secret-only";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-only";
process.env.REFRESH_TOKEN_TTL_SECONDS = "604800";

const { redisClient } = require("../db/redis");
const User = require("../src/models/user.model");
const Session = require("../src/models/session.model");
const app = require("../src/app");
const cache = new Map();
const sessionRecords = new Map();
let cacheUnavailable = false;
let sessionStoreUnavailable = false;
let users = [];
let server;
let baseUrl;
let passwordHash;

// Only external storage is replaced: HTTP routing, cookies, bcrypt and JWTs are real.
redisClient.set = async (key, value, options) => {
    if (cacheUnavailable) throw new Error("Redis unavailable");
    cache.set(key, { value, expiresAt: Date.now() + options.EX * 1000 });
    return "OK";
};
redisClient.get = async (key) => {
    if (cacheUnavailable) throw new Error("Redis unavailable");
    const entry = cache.get(key);
    return entry && entry.expiresAt > Date.now() ? entry.value : null;
};
redisClient.del = async (key) => {
    if (cacheUnavailable) throw new Error("Redis unavailable");
    return (Array.isArray(key) ? key : [key]).reduce((count, item) => count + Number(cache.delete(item)), 0);
};
const matchingSessions = (filter) => {
    if (sessionStoreUnavailable) throw new Error("MongoDB unavailable");
    return [...sessionRecords.values()].filter((session) => Object.entries(filter).every(([key, value]) =>
        value && typeof value === "object" && "$gt" in value ? session[key] > value.$gt : session[key] === value,
    ));
};
Session.create = async (details) => {
    if (sessionStoreUnavailable) throw new Error("MongoDB unavailable");
    const document = new Session(details);
    const error = document.validateSync();
    if (error) throw error;
    const session = { ...document.toObject(), user: String(document.user) };
    sessionRecords.set(session.refreshId, session);
    return session;
};
Session.findOne = async (filter) => matchingSessions(filter)[0] || null;
Session.distinct = async (field, filter) => matchingSessions(filter).map((session) => session[field]);
Session.updateOne = async (filter, update) => {
    const session = matchingSessions(filter)[0];
    if (session) Object.assign(session, update.$set);
    return { modifiedCount: Number(Boolean(session)) };
};
Session.updateMany = async (filter, update) => {
    const matches = matchingSessions(filter);
    matches.forEach((session) => Object.assign(session, update.$set));
    return { modifiedCount: matches.length };
};
User.findOne = async ({ email }) => users.find((user) => user.email === email);
User.findById = async (id) => users.find((user) => user._id === id);
User.create = async (details) => {
    const user = { ...details, _id: "507f1f77bcf86cd799439012" };
    users.push(user);
    return user;
};

before(async () => {
    passwordHash = await bcrypt.hash("Password123", 4);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
});
after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
beforeEach(() => {
    cache.clear();
    sessionRecords.clear();
    cacheUnavailable = false;
    sessionStoreUnavailable = false;
    users = [{ _id: "507f1f77bcf86cd799439011", name: "Test User", email: "test@example.com", password: passwordHash }];
});

const request = async (path, { method = "GET", body, cookie, headers = {} } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...headers, ...(cookie ? { Cookie: cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
        status: response.status, data: await response.json(), cookies: response.headers.getSetCookie(),
        renewedToken: response.headers.get("X-Access-Token"),
        cacheControl: response.headers.get("Cache-Control"),
    };
};
const login = () => request("/login", { method: "POST", body: { email: "test@example.com", password: "Password123" } });
const valueOf = (cookies, name) => cookies.find((cookie) => cookie.startsWith(`${name}=`))?.split(";")[0].slice(name.length + 1);
const cookieHeader = (result) => `refreshToken=${valueOf(result.cookies, "refreshToken")}`;
const auth = (result) => ({ cookie: cookieHeader(result), headers: { Authorization: `Bearer ${result.data.accessToken}` } });

test("login issues 15 minute access token and fixed 7 day refresh cookie with a hashed Redis record", async () => {
    const result = await login();
    assert.equal(result.status, 200);
    const access = jwt.verify(result.data.accessToken, process.env.JWT_SECRET);
    const refresh = jwt.verify(valueOf(result.cookies, "refreshToken"), process.env.JWT_REFRESH_SECRET);
    assert.equal(access.exp - access.iat, 900);
    assert.equal(refresh.exp - refresh.iat, 604800);
    assert.equal(access.refreshId, refresh.jti);
    assert.equal(access.role, undefined);
    assert.equal(result.data.user.password, undefined);
    assert.equal(result.data.user.role, undefined);
    const storedSession = sessionRecords.get(refresh.jti);
    assert.equal(result.data.session.id, String(storedSession._id));
    assert.match(result.data.session.id, /^[a-f0-9]{24}$/);
    assert.equal(result.data.session.deviceIp, null);
    assert.equal(result.data.session.internetIp, "127.0.0.1");
    assert.equal(result.data.session.revoked, false);
    assert.equal(result.data.session.refreshId, undefined);
    assert.equal(typeof result.data.accessToken, "string");
    assert.equal(result.cacheControl, "no-store");
    assert.equal(valueOf(result.cookies, "accessToken"), "");
    assert.equal(result.data.refreshToken, undefined);
    for (const name of ["refreshToken"]) {
        const cookie = result.cookies.find((item) => item.startsWith(`${name}=`));
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Strict/);
        assert.match(cookie, /Path=\/api/);
    }
    const record = JSON.parse(cache.get(`auth:refresh:${refresh.jti}`).value);
    assert.equal(record.hash.length, 64);
    assert.notEqual(record.hash, valueOf(result.cookies, "refreshToken"));
    assert.equal([...cache.values()].some((entry) => entry.value.includes(result.data.accessToken)), false);
    assert.equal(JSON.stringify(storedSession).includes(result.data.accessToken), false);
    const protectedResponse = await request("/me", { headers: auth(result).headers });
    assert.equal(protectedResponse.status, 200);
    assert.equal(protectedResponse.renewedToken, null);
});

test("expired access token refreshes within the original request without a 401", async () => {
    const loggedIn = await login();
    const decoded = jwt.decode(loggedIn.data.accessToken);
    const expired = jwt.sign({ id: decoded.id, refreshId: decoded.refreshId, type: "access" }, process.env.JWT_SECRET, { expiresIn: -1 });
    const result = await request("/me", { cookie: cookieHeader(loggedIn), headers: { Authorization: `Bearer ${expired}` } });
    assert.equal(result.status, 200);
    const renewed = jwt.verify(result.renewedToken, process.env.JWT_SECRET);
    assert.equal(renewed.exp - renewed.iat, 900);
    assert.equal(renewed.id, decoded.id);
});

test("missing access token refreshes automatically and concurrent requests both succeed", async () => {
    const loggedIn = await login();
    const cookie = `refreshToken=${valueOf(loggedIn.cookies, "refreshToken")}`;
    const [first, second] = await Promise.all([request("/me", { cookie }), request("/me", { cookie })]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.ok(first.renewedToken);
    assert.ok(second.renewedToken);
    assert.equal(first.cookies.length, 0);
    assert.equal(second.cookies.length, 0);
});

test("automatic refresh keeps the refresh token and Redis expiry unchanged", async () => {
    const loggedIn = await login();
    const originalRecord = [...cache.values()][0];
    const result = await request("/me", { cookie: `refreshToken=${valueOf(loggedIn.cookies, "refreshToken")}` });
    assert.equal(result.status, 200);
    assert.ok(result.renewedToken);
    assert.equal(valueOf(result.cookies, "refreshToken"), undefined);
    assert.deepEqual([...cache.values()][0], originalRecord);
});

test("logout revokes both old access and refresh tokens immediately", async () => {
    const loggedIn = await login();
    const cookie = cookieHeader(loggedIn);
    const result = await request("/logout", { method: "POST", cookie });
    assert.equal(result.status, 200);
    assert.equal(cache.size, 0);
    assert.equal([...sessionRecords.values()][0].revoked, true);
    assert.ok([...sessionRecords.values()][0].revokedAt instanceof Date);
    assert.match(result.cookies.find((item) => item.startsWith("refreshToken=")), /Expires=Thu, 01 Jan 1970/);
    assert.equal((await request("/me", { headers: auth(loggedIn).headers })).status, 401);
    assert.equal((await request("/me", { cookie: `refreshToken=${valueOf(loggedIn.cookies, "refreshToken")}` })).status, 401);
});

test("expired refresh token is rejected even with a Redis record", async () => {
    const refreshToken = jwt.sign({ id: users[0]._id, type: "refresh" }, process.env.JWT_REFRESH_SECRET, { jwtid: "expired", expiresIn: -1 });
    cache.set("auth:refresh:expired", { value: "{}", expiresAt: Date.now() + 10000 });
    const result = await request("/me", { cookie: `refreshToken=${refreshToken}` });
    assert.equal(result.status, 401);
});

test("expired Redis record prevents use of an otherwise valid access token", async () => {
    const loggedIn = await login();
    [...cache.values()][0].expiresAt = Date.now() - 1;
    assert.equal((await request("/me", { ...auth(loggedIn) })).status, 401);
});

test("tampered access token does not silently refresh", async () => {
    const loggedIn = await login();
    const result = await request("/me", { cookie: cookieHeader(loggedIn), headers: { Authorization: "Bearer fake-token" } });
    assert.equal(result.status, 401);
    assert.equal(result.renewedToken, null);
});

test("refresh tokens cannot be used as access tokens", async () => {
    const loggedIn = await login();
    const refresh = valueOf(loggedIn.cookies, "refreshToken");
    assert.equal((await request("/me", { cookie: `refreshToken=${refresh}`, headers: { Authorization: `Bearer ${refresh}` } })).status, 401);
});

test("Redis outage returns 503 without clearing login cookies", async () => {
    const loggedIn = await login();
    cacheUnavailable = true;
    const result = await request("/me", { ...auth(loggedIn) });
    assert.equal(result.status, 503);
    assert.equal(result.cookies.length, 0);
});

test("login again replaces and revokes the previous token pair", async () => {
    const previous = await login();
    const current = await request("/login", { method: "POST", ...auth(previous), body: { email: "test@example.com", password: "Password123" } });
    assert.equal(current.status, 200);
    assert.equal(cache.size, 1);
    assert.equal(sessionRecords.size, 2);
    assert.equal([...sessionRecords.values()].filter((session) => session.revoked).length, 1);
    assert.equal((await request("/me", { ...auth(previous) })).status, 401);
    assert.equal((await request("/me", { ...auth(current) })).status, 200);
});

test("registration hashes the password and does not include roles", async () => {
    const result = await request("/register", { method: "POST", body: { name: "New User", email: "new@example.com", password: "Password123", confirmPassword: "Password123", role: "admin", tenant: "old" } });
    assert.equal(result.status, 201);
    const user = users.find((item) => item.email === "new@example.com");
    assert.equal(await bcrypt.compare("Password123", user.password), true);
    assert.equal(user.role, undefined);
    assert.equal(user.tenant, undefined);
    assert.equal(result.data.user.password, undefined);
});

test("invalid login credentials fail without issuing cookies", async () => {
    const result = await request("/login", { method: "POST", body: { email: "test@example.com", password: "incorrect" } });
    assert.equal(result.status, 401);
    assert.equal(result.cookies.length, 0);
});

test("unauthenticated requests require login and logout is idempotent", async () => {
    assert.equal((await request("/me")).status, 401);
    assert.equal((await request("/logout", { method: "POST" })).status, 200);
});

test("login stores device IP, observed internet IP, user agent and session expiry", async () => {
    const result = await request("/login", {
        method: "POST",
        body: { email: "test@example.com", password: "Password123", deviceIp: "192.168.1.10", internetIp: "203.0.113.5" },
        headers: { "User-Agent": "Test device", "X-Forwarded-For": "203.0.113.6" },
    });
    assert.equal(result.status, 200);
    const session = [...sessionRecords.values()][0];
    const refresh = jwt.decode(valueOf(result.cookies, "refreshToken"));
    assert.equal(session.user, users[0]._id);
    assert.equal(session.refreshId, refresh.jti);
    assert.equal(session.deviceIp, "192.168.1.10");
    assert.equal(result.data.session.id, String(session._id));
    assert.equal(result.data.session.deviceIp, session.deviceIp);
    assert.equal(result.data.session.internetIp, session.internetIp);
    assert.equal(result.data.session.userAgent, session.userAgent);
    assert.equal(result.data.session.expiresAt, session.expiresAt.toISOString());
    assert.equal(session.internetIp, "127.0.0.1");
    assert.equal(session.userAgent, "Test device");
    assert.equal(session.expiresAt.getTime(), refresh.exp * 1000);
    assert.equal(session.revoked, false);
    assert.equal(session.revokedAt, null);
});

test("device IP is optional and accepts IPv6, while invalid IPs fail validation", async () => {
    assert.equal((await login()).status, 200);
    assert.equal([...sessionRecords.values()][0].deviceIp, null);
    const ipv6 = await request("/login", { method: "POST", body: { email: "test@example.com", password: "Password123", deviceIp: "fd00::123" } });
    assert.equal(ipv6.status, 200);
    assert.equal([...sessionRecords.values()][1].deviceIp, "fd00::123");
    const invalid = await request("/login", { method: "POST", body: { email: "test@example.com", password: "Password123", deviceIp: "not-an-ip" } });
    assert.equal(invalid.status, 422);
    assert.equal(sessionRecords.size, 2);
});

test("normal logout revokes only the current device and preserves its document", async () => {
    const firstDevice = await login();
    const secondDevice = await login();
    const firstId = jwt.decode(valueOf(firstDevice.cookies, "refreshToken")).jti;
    const secondId = jwt.decode(valueOf(secondDevice.cookies, "refreshToken")).jti;
    assert.equal((await request("/logout", { method: "POST", ...auth(firstDevice) })).status, 200);
    assert.equal(sessionRecords.size, 2);
    assert.equal(sessionRecords.get(firstId).revoked, true);
    assert.equal(sessionRecords.get(secondId).revoked, false);
    assert.equal((await request("/me", { ...auth(secondDevice) })).status, 200);
    const revokedAt = sessionRecords.get(firstId).revokedAt;
    await request("/logout", { method: "POST", ...auth(firstDevice) });
    assert.equal(sessionRecords.get(firstId).revokedAt, revokedAt);
});

test("logout all revokes every session for the authenticated account and leaves other accounts alone", async () => {
    const firstDevice = await login();
    const secondDevice = await login();
    // Include an expired session: logout-all must mark it revoked as well.
    const expiredDevice = await login();
    sessionRecords.get(jwt.decode(valueOf(expiredDevice.cookies, "refreshToken")).jti).expiresAt = new Date(0);
    users.push({ _id: "507f1f77bcf86cd799439013", name: "Other User", email: "other@example.com", password: passwordHash });
    const otherAccount = await request("/login", { method: "POST", body: { email: "other@example.com", password: "Password123" } });
    const result = await request("/logout-all", { method: "POST", ...auth(firstDevice), body: { userId: users[1]._id } });
    assert.equal(result.status, 200);
    assert.equal(result.data.revokedCount, 3);
    assert.equal(sessionRecords.size, 4);
    for (const session of sessionRecords.values()) {
        assert.equal(session.revoked, session.user === users[0]._id);
    }
    assert.equal(cache.size, 1);
    assert.equal((await request("/me", { ...auth(firstDevice) })).status, 401);
    assert.equal((await request("/me", { ...auth(secondDevice) })).status, 401);
    assert.equal((await request("/me", { cookie: `refreshToken=${valueOf(secondDevice.cookies, "refreshToken")}` })).status, 401);
    assert.equal((await request("/me", { ...auth(otherAccount) })).status, 200);
    assert.equal((await request("/me", { cookie: `refreshToken=${valueOf(otherAccount.cookies, "refreshToken")}` })).status, 200);
});

test("logout all authenticates with the refresh cookie and clears the renewed response token", async () => {
    const loggedIn = await login();
    const result = await request("/logout-all", { method: "POST", cookie: `refreshToken=${valueOf(loggedIn.cookies, "refreshToken")}` });
    assert.equal(result.status, 200);
    assert.equal(result.data.revokedCount, 1);
    assert.equal(result.renewedToken, null);
    assert.equal([...sessionRecords.values()][0].revoked, true);
    assert.equal((await request("/me", { ...auth(loggedIn) })).status, 401);
});

test("logout all requires authentication", async () => {
    await login();
    assert.equal((await request("/logout-all", { method: "POST", body: { userId: users[0]._id } })).status, 401);
    assert.equal([...sessionRecords.values()][0].revoked, false);
});

test("revoked sessions block access and refresh even when Redis still holds tokens", async () => {
    const loggedIn = await login();
    [...sessionRecords.values()][0].revoked = true;
    assert.equal(cache.size, 1);
    assert.equal((await request("/me", { ...auth(loggedIn) })).status, 401);
    assert.equal((await request("/me", { cookie: `refreshToken=${valueOf(loggedIn.cookies, "refreshToken")}` })).status, 401);
});

test("expired session prevents using an otherwise valid access or refresh token", async () => {
    const loggedIn = await login();
    [...sessionRecords.values()][0].expiresAt = new Date(0);
    assert.equal((await request("/me", { ...auth(loggedIn) })).status, 401);
    assert.equal((await request("/me", { cookie: `refreshToken=${valueOf(loggedIn.cookies, "refreshToken")}` })).status, 401);
});

test("logout persists revocation when Redis cleanup fails", async () => {
    const loggedIn = await login();
    cacheUnavailable = true;
    const result = await request("/logout", { method: "POST", ...auth(loggedIn) });
    assert.equal(result.status, 200);
    assert.equal(cache.size, 1);
    assert.equal([...sessionRecords.values()][0].revoked, true);
    cacheUnavailable = false;
    assert.equal((await request("/me", { ...auth(loggedIn) })).status, 401);
});

test("logout can revoke the current session using only a valid bearer access token", async () => {
    const loggedIn = await login();
    const result = await request("/logout", { method: "POST", headers: auth(loggedIn).headers });
    assert.equal(result.status, 200);
    assert.equal([...sessionRecords.values()][0].revoked, true);
});

test("signed expired refresh token can still mark its session revoked on logout", async () => {
    const loggedIn = await login();
    const decoded = jwt.decode(valueOf(loggedIn.cookies, "refreshToken"));
    const expired = jwt.sign({ id: decoded.id, type: "refresh" }, process.env.JWT_REFRESH_SECRET, { jwtid: decoded.jti, expiresIn: -1 });
    const result = await request("/logout", { method: "POST", cookie: `refreshToken=${expired}` });
    assert.equal(result.status, 200);
    assert.equal(sessionRecords.get(decoded.jti).revoked, true);
});

test("session database outage fails closed without clearing login cookies", async () => {
    const loggedIn = await login();
    sessionStoreUnavailable = true;
    for (const [path, method] of [["/me", "GET"], ["/logout", "POST"], ["/logout-all", "POST"]]) {
        const result = await request(path, { method, ...auth(loggedIn) });
        assert.equal(result.status, 503);
        assert.equal(result.cookies.length, 0);
    }
});

test("failed token cache creation revokes the newly created session", async () => {
    cacheUnavailable = true;
    const result = await login();
    assert.equal(result.status, 503);
    assert.equal(result.cookies.length, 0);
    assert.equal([...sessionRecords.values()][0].revoked, true);
});

test("there is no separate refresh endpoint", async () => {
    const loggedIn = await login();
    const response = await fetch(`${baseUrl}/refresh`, {
        method: "POST", headers: { Cookie: cookieHeader(loggedIn) },
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.getSetCookie().length, 0);
    await response.text();
});
