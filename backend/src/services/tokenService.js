const jwt = require("jsonwebtoken");
const { randomUUID, createHash } = require("node:crypto");
const { redisClient } = require("../../db/redis");
const sessions = require("./sessionService");

const ACCESS_TOKEN_SECONDS = 900;
const REFRESH_TOKEN_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 604800);
if (!Number.isSafeInteger(REFRESH_TOKEN_SECONDS) || REFRESH_TOKEN_SECONDS <= 0) {
    throw new Error("REFRESH_TOKEN_TTL_SECONDS must be a positive integer");
}
const authError = (message = "Please log in again") => Object.assign(new Error(message), { statusCode: 401 });
const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.MODE === "production",
    sameSite: "strict",
    path: "/api",
});
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const tokenKey = (id) => `auth:refresh:${id}`;
const cacheCommand = async (operation) => {
    try { return await operation(); }
    catch { throw Object.assign(new Error("Authentication service is temporarily unavailable"), { statusCode: 503 }); }
};
const signAccessToken = (userId, refreshId) => jwt.sign(
    { id: String(userId), refreshId, type: "access" }, process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: ACCESS_TOKEN_SECONDS },
);
const createTokens = async (userId, metadata = {}) => {
    const refreshId = randomUUID();
    const refreshToken = jwt.sign(
        { id: String(userId), type: "refresh" }, process.env.JWT_REFRESH_SECRET,
        { algorithm: "HS256", jwtid: refreshId, expiresIn: REFRESH_TOKEN_SECONDS },
    );
    const accessToken = signAccessToken(userId, refreshId);
    const session = await sessions.createSession({
        user: userId,
        refreshId,
        deviceIp: metadata.deviceIp || null,
        internetIp: metadata.internetIp || null,
        userAgent: (metadata.userAgent || "").slice(0, 512),
        expiresAt: new Date(jwt.decode(refreshToken).exp * 1000),
    });
    try {
        await cacheCommand(() => redisClient.set(tokenKey(refreshId), JSON.stringify({
            userId: String(userId), hash: hashToken(refreshToken),
        }), { EX: REFRESH_TOKEN_SECONDS }));
    } catch (error) {
        await sessions.revokeSession(userId, refreshId);
        throw error;
    }
    return { accessToken, refreshToken, session };
};
const verifyToken = (token, secret, type) => {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (decoded.type !== type || typeof decoded.id !== "string" || !decoded.exp ||
        (type === "refresh" ? typeof decoded.jti !== "string" : typeof decoded.refreshId !== "string")) {
        throw authError("Invalid authentication token");
    }
    return decoded;
};
const verifyAccessToken = (token) => verifyToken(token, process.env.JWT_SECRET, "access");
const getRecord = async (id) => {
    const record = await cacheCommand(() => redisClient.get(tokenKey(id)));
    if (!record) throw authError();
    try { return JSON.parse(record); } catch { throw authError(); }
};
const validateAccessToken = async (decoded) => {
    await sessions.validateSession(decoded.id, decoded.refreshId);
    const record = await getRecord(decoded.refreshId);
    if (record.userId !== decoded.id) throw authError();
    return decoded;
};
const verifyRefreshToken = async (token) => {
    if (!token) throw authError("Authentication is required");
    let decoded;
    try { decoded = verifyToken(token, process.env.JWT_REFRESH_SECRET, "refresh"); }
    catch { throw authError(); }
    await sessions.validateSession(decoded.id, decoded.jti);
    const record = await getRecord(decoded.jti);
    if (record.userId !== decoded.id || record.hash !== hashToken(token)) throw authError();
    return decoded;
};
const refreshAccessToken = async (token) => {
    const decoded = await verifyRefreshToken(token);
    return {
        accessToken: signAccessToken(decoded.id, decoded.jti),
        user: { id: decoded.id, refreshId: decoded.jti, type: "access" },
    };
};
const readAccessToken = (req) => {
    const authorization = req.get("authorization");
    if (!authorization) return undefined;
    const match = authorization.match(/^Bearer ([^\s]+)$/i);
    if (!match) throw authError("Invalid Authorization header");
    return match[1];
};
const clearAuthCookies = (res) => {
    res.removeHeader("X-Access-Token");
    res.clearCookie("accessToken", cookieOptions());
    res.clearCookie("refreshToken", cookieOptions());
    res.clearCookie("token", { ...cookieOptions(), path: "/" });
};
const setAuthCookies = (res, tokens) => {
    res.clearCookie("token", { ...cookieOptions(), path: "/" });
    res.clearCookie("accessToken", cookieOptions());
    res.cookie("refreshToken", tokens.refreshToken, {
        ...cookieOptions(), maxAge: REFRESH_TOKEN_SECONDS * 1000,
    });
};
const deleteCachedTokens = async (refreshIds) => {
    if (!refreshIds.length) return;
    try {
        await redisClient.del(refreshIds.map(tokenKey));
    } catch {
        // MongoDB revocation is authoritative, including when Redis is unavailable.
        console.warn("Revoked sessions saved; Redis token cleanup unavailable");
    }
};

const revokeRefreshToken = async (token, accessToken) => {
    let userId;
    let refreshId;
    if (token) {
        try {
            // Even an expired, correctly signed refresh token can revoke its session.
            const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ["HS256"], ignoreExpiration: true });
            if (decoded.type === "refresh" && typeof decoded.id === "string" && typeof decoded.jti === "string") {
                userId = decoded.id;
                refreshId = decoded.jti;
            }
        } catch { /* Try a valid bearer token if the refresh cookie is absent or invalid. */ }
    }
    if (!refreshId && accessToken) {
        try {
            const decoded = verifyAccessToken(accessToken);
            userId = decoded.id;
            refreshId = decoded.refreshId;
        } catch { /* Logout remains idempotent for invalid credentials. */ }
    }
    if (!refreshId) return;
    await sessions.revokeSession(userId, refreshId);
    await deleteCachedTokens([refreshId]);
};

const revokeAllUserSessions = async (userId) => {
    const { refreshIds, revokedCount } = await sessions.revokeAllSessions(userId);
    await deleteCachedTokens(refreshIds);
    return revokedCount;
};
module.exports = {
    createTokens, verifyAccessToken, validateAccessToken, refreshAccessToken,
    readAccessToken, setAuthCookies, clearAuthCookies, revokeRefreshToken,
    revokeAllUserSessions,
};
