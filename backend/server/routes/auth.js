const express = require("express");
const { getProfile, updateWallet } = require("../controllers/authController");
const { getNonce, verifySignature, getSIWEProfile, walletLogin, checkWallet, getNonceSimple, registerWallet } = require("../controllers/siweController");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

const walletValidation = [
  require("express-validator").body("walletAddress")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .custom((value) => {
      if (!value) return true;
      const addrRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!addrRegex.test(value)) throw new Error("Invalid Ethereum wallet address");
      return true;
    }),
];

// ── Wallet Login (direct, no nonce required) ──
router.post("/wallet-login", walletLogin);

// ── Check if wallet exists ──
router.post("/check-wallet", checkWallet);

// ── Simple Nonce (for register flow) ──
router.get("/nonce", getNonceSimple);

// ── Register (nonce-based) ──
router.post("/register", registerWallet);

// ── SIWE (Sign-In With Ethereum) Auth ──
router.post("/siwe/nonce", getNonce);
router.post("/siwe/verify", verifySignature);
router.get("/siwe/me", authMiddleware, getSIWEProfile);

// ── Profile ──
router.get("/profile", authMiddleware, getProfile);

// ── Wallet ──
router.put("/wallet", authMiddleware, walletValidation, updateWallet);
router.patch("/wallet", authMiddleware, walletValidation, updateWallet);

module.exports = router;
