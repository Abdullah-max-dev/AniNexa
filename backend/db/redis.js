const { createClient } = require("redis");

const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    disableOfflineQueue: true,
    socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => retries < 3 ? 500 : false,
    },
});
redisClient.on("error", (error) => console.error("Redis connection error:", error.message));

const connectRedis = async () => {
    if (!redisClient.isOpen) await redisClient.connect();
    console.log("Redis connected successfully");
};
module.exports = { redisClient, connectRedis };
