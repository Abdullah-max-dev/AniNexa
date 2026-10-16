const mongoose = require("mongoose");
const { isIP } = require("node:net");

const ipField = () => ({
    type: String,
    default: null,
    validate: { validator: (value) => value == null || isIP(value) !== 0, message: "Invalid IP address" },
});

const sessionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    refreshId: { type: String, required: true, unique: true },
    // Optional client-reported local IP; never used to authenticate a user.
    deviceIp: ipField(),
    // Address observed by Express, respecting explicitly trusted proxies.
    internetIp: ipField(),
    userAgent: { type: String, default: "", maxlength: 512 },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false, required: true },
    revokedAt: { type: Date, default: null },
}, { timestamps: true });

sessionSchema.index({ user: 1, revoked: 1 });
// Keep revoked and expired documents as history instead of deleting them with a TTL.
module.exports = mongoose.model("Session", sessionSchema);
