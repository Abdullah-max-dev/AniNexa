const express = require("express");
const { getHomeController } = require("./home.controller");

const router = express.Router();

router.get("/", getHomeController);

module.exports = router;
