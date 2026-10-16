const express = require("express");

const { loginController, registerController, logoutController, logoutAllController, meController } = require("./authController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { validateRegister, validateLogin } = require("./authValidation");

const router = express.Router();

router.post("/register", validateRegister, registerController);
router.post("/login", validateLogin, loginController);
router.post("/logout", logoutController);
router.post("/logout-all", authMiddleware, logoutAllController);
router.get("/me", authMiddleware, meController);

module.exports = router;
