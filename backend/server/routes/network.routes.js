const express = require("express");
const { authMiddleware } = require("../middleware/auth.middleware");
const { expandNetwork } = require("../controllers/networkController");

const router = express.Router();

router.get("/:userId/expand", authMiddleware, expandNetwork);

module.exports = router;
