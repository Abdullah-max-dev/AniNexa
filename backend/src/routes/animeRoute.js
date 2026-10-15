const express = require("express");
const { listAnimeController } = require("../controllers/animeController");

const router = express.Router();
router.get("/", listAnimeController);

module.exports = router;
