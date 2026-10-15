const express = require("express");
require("dotenv").config();
const authRouter = require("./routes/authRoute");
const animeRouter = require("./routes/animeRoute");
const globalErrorHandler = require("./globalMiddlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
if (process.env.TRUST_PROXY) {
    app.set("trust proxy", process.env.TRUST_PROXY.split(",").map((value) => value.trim()).filter(Boolean));
}
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    exposedHeaders: ["X-Access-Token"],
}));
app.use(express.json());
app.use(cookieParser());

// all routes will mount here
app.use("/api/auth", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
}, authRouter);
app.use("/api/anime", animeRouter);

app.use(globalErrorHandler);

module.exports = app;
