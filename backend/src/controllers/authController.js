const authService = require("../services/authService");
const tokenService = require("../services/tokenService");
const User = require("../models/user.model");
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email });

const registerController = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        const user = await authService.registerUser({
            name,
            email,
            password,
        });

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: publicUser(user),
        });
    } catch (error) {
        next(error);
    }
};

const loginController = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const { user, tokens, session } = await authService.loginUser({
            email,
            password,
        }, {
            deviceIp: req.body.deviceIp,
            internetIp: req.ip || req.socket.remoteAddress,
            userAgent: req.get("user-agent"),
        });

        await tokenService.revokeRefreshToken(req.cookies.refreshToken, tokenService.readAccessToken(req));
        tokenService.setAuthCookies(res, tokens);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            accessToken: tokens.accessToken,
            user: publicUser(user),
            session: {
                id: session._id,
                deviceIp: session.deviceIp,
                internetIp: session.internetIp,
                userAgent: session.userAgent,
                expiresAt: session.expiresAt,
                revoked: session.revoked,
                revokedAt: session.revokedAt,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};


const logoutController = async (req, res, next) => {
    try {
        await tokenService.revokeRefreshToken(req.cookies.refreshToken, tokenService.readAccessToken(req));
        tokenService.clearAuthCookies(res);
        res.json({ success: true, message: "Logged out successfully" });
    } catch (error) { next(error); }
};

const logoutAllController = async (req, res, next) => {
    try {
        const revokedCount = await tokenService.revokeAllUserSessions(req.user.id);
        tokenService.clearAuthCookies(res);
        res.json({ success: true, message: "Logged out from all devices", revokedCount });
    } catch (error) { next(error); }
};

const meController = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            await tokenService.revokeRefreshToken(req.cookies.refreshToken);
            tokenService.clearAuthCookies(res);
            return res.status(401).json({ success: false, message: "User no longer exists" });
        }
        res.json({ success: true, user: publicUser(user) });
    } catch (error) { next(error); }
};

module.exports = {
    registerController,
    loginController,
    logoutController,
    logoutAllController,
    meController,
};
