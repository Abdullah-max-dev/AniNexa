require("dotenv").config();
const connectDb = require("./db/db");
const app = require("./src/app")
const { connectRedis } = require("./db/redis");


const startServer = async () => {
    try {
        if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
            throw new Error("JWT_SECRET and JWT_REFRESH_SECRET are required");
        }
        await connectDb();
        await connectRedis();
        const port = process.env.PORT || 3000;
        app.listen(port, () => console.log(`Server is running on port ${port}`));
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};
startServer();

