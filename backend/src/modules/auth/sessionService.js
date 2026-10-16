const Session = require("./session.model");

const databaseCommand = async (operation) => {
    try {
        return await operation();
    } catch {
        throw Object.assign(new Error("Session service is temporarily unavailable"), { statusCode: 503 });
    }
};

const createSession = (details) => databaseCommand(() => Session.create(details));

const validateSession = async (userId, refreshId) => {
    const session = await databaseCommand(() => Session.findOne({
        user: userId, refreshId, revoked: false, expiresAt: { $gt: new Date() },
    }));
    if (!session) {
        throw Object.assign(new Error("Session expired or revoked; please log in again"), { statusCode: 401 });
    }
    return session;
};

const revokeSession = (userId, refreshId) => databaseCommand(() => Session.updateOne(
    { user: userId, refreshId, revoked: false },
    { $set: { revoked: true, revokedAt: new Date() } },
));

const revokeAllSessions = async (userId) => {
    const refreshIds = await databaseCommand(() => Session.distinct("refreshId", { user: userId, revoked: false }));
    const result = await databaseCommand(() => Session.updateMany(
        { user: userId, revoked: false },
        { $set: { revoked: true, revokedAt: new Date() } },
    ));
    return { refreshIds, revokedCount: result.modifiedCount };
};

module.exports = { createSession, validateSession, revokeSession, revokeAllSessions };
