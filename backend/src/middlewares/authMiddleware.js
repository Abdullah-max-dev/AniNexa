const tokens = require("../services/tokenService");

const authMiddleware = async (req, res, next) => {
    try {
        res.set("Cache-Control", "no-store");
        const accessToken = tokens.readAccessToken(req);
        let decoded;
        if (accessToken) {
            try {
                decoded = tokens.verifyAccessToken(accessToken);
            } catch (error) {
                if (error.name !== "TokenExpiredError") {
                    throw Object.assign(new Error("Invalid authentication token"), { statusCode: 401 });
                }
            }
        }
        if (decoded) {
            req.user = await tokens.validateAccessToken(decoded);
        } else {
            // Also restore frontend memory after a page reload using the refresh cookie.
            const refreshed = await tokens.refreshAccessToken(req.cookies.refreshToken);
            res.set("X-Access-Token", refreshed.accessToken);
            req.user = refreshed.user;
        }
        return next();
    } catch (error) {
        if (error.statusCode === 401) tokens.clearAuthCookies(res);
        return next(error);
    }
};

module.exports = authMiddleware;
