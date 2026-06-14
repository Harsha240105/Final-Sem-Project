const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../../../database/models/User");
const Student = require("../../../database/models/Student");
const Teacher = require("../../../database/models/Teacher");
const AdminUser = require("../../../database/models/AdminUser");
const Nonce = require("../../../database/models/Nonce");
const { generateDID } = require("../utils/didGenerator");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET = process.env.JWT_SECRET;
const NONCE_EXPIRY_MS = 5 * 60 * 1000;
const SIWE_VERSION = "1";
const SIWE_CHAIN_ID = 80002;
const SIWE_URI = process.env.SIWE_URI || "http://localhost:5173";

const VALID_ROLES = ["student", "teacher", "admin", "community_manager"];

function generateNonce() {
  return crypto.randomBytes(32).toString("hex");
}

function buildSIWEMessage({ walletAddress, nonce }) {
  return [
    `Web3Connect wants you to sign in.`,
    ``,
    `Wallet:`,
    `${walletAddress}`,
    ``,
    `Nonce:`,
    `${nonce}`,
    ``,
    `Chain:`,
    `Polygon Amoy`,
    ``,
    `URI:`,
    `${SIWE_URI}`,
    ``,
    `Version:`,
    `${SIWE_VERSION}`,
    ``,
    `Issued At:`,
    `${new Date().toISOString()}`,
  ].join("\n");
}

function buildAuthMessage({ walletAddress, role, nonce }) {
  return `Web3Connect Authentication\n\nWallet:\n${walletAddress}\n\nRole:\n${role}\n\nNonce:\n${nonce}`;
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      walletAddress: user.walletAddress,
      did: user.did,
      authMethod: "wallet",
      verificationStatus: user.verificationStatus || "pending",
      onboardingCompleted: user.onboardingCompleted || false,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function formatUserResponse(user) {
  return {
    id: user._id,
    name: user.name,
    username: user.username,
    role: user.role,
    walletAddress: user.walletAddress,
    did: user.did,
    avatar: user.avatar,
    collegeName: user.collegeName,
    institutionName: user.institutionName,
    approved: user.approved,
    verificationStatus: user.verificationStatus || "pending",
    onboardingCompleted: user.onboardingCompleted || false,
  };
}

/**
 * GET /api/auth/nonce
 * Generate a nonce for authentication
 */
async function getNonceSimple(req, res) {
  try {
    const nonce = generateNonce();
    const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MS);
    await Nonce.create({ nonce, expiresAt });
    res.json({ nonce, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error("getNonceSimple error:", err);
    res.status(500).json({ error: "Failed to generate nonce" });
  }
}

/**
 * POST /api/auth/register
 * Register a new user with wallet + nonce-based SIWE
 */
async function registerWallet(req, res) {
  let normalized;
  try {
    const { address, signature, message, role, name, username } = req.body;

    // ── 1. Validate inputs ──
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    if (!signature) {
      return res.status(400).json({ error: "Signature is required" });
    }
    if (!message) {
      return res.status(400).json({ error: "Signed message is required" });
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Valid role is required (student, teacher, or admin)" });
    }

    normalized = address.toLowerCase().trim();
    console.log(`[registerWallet] Processing registration for wallet=${normalized} role=${role}`);

    // ── 2. Extract nonce from the signed message ──
    const nonceMatch = message.match(/Nonce:\s*(\S+)/);
    if (!nonceMatch) {
      console.log(`[registerWallet] Nonce not found in message for ${normalized}`);
      return res.status(400).json({ error: "Invalid message format: nonce not found" });
    }
    const messageNonce = nonceMatch[1];

    // ── 3. Verify nonce exists and is still valid ──
    const nonceDoc = await Nonce.findOne({
      nonce: messageNonce,
      used: false,
      expiresAt: { $gt: new Date() },
    });
    if (!nonceDoc) {
      console.log(`[registerWallet] Nonce expired/invalid for ${normalized}`);
      return res.status(401).json({ error: "Nonce expired or invalid. Request a new one." });
    }

    // ── 4. Verify the signature ──
    try {
      let sig = signature;
      if (typeof sig === "object" && sig?.toString) sig = sig.toString();
      sig = String(sig).trim();
      if (!sig.startsWith("0x")) sig = "0x" + sig;

      const recoveredAddress = ethers.verifyMessage(message, sig);
      if (recoveredAddress.toLowerCase() !== normalized) {
        console.log(`[registerWallet] Signature mismatch for ${normalized}: recovered=${recoveredAddress.toLowerCase()}`);
        return res.status(401).json({ error: "Invalid signature" });
      }
    } catch (sigErr) {
      console.log(`[registerWallet] Signature verification error for ${normalized}:`, sigErr.message);
      console.log(`[registerWallet] Message preview: "${(message || "").substring(0, 80)}..."`);
      console.log(`[registerWallet] Signature type: ${typeof signature}, length: ${String(signature || "").length}`);
      return res.status(401).json({ error: "Invalid signature format" });
    }

    // ── 5. Mark nonce as used ──
    await Nonce.findByIdAndUpdate(nonceDoc._id, { used: true });
    console.log(`[registerWallet] Nonce ${messageNonce} marked used for ${normalized}`);

    // ── 6. Check existing user across all collections ──
    const did = generateDID(normalized);
    console.log(`[registerWallet] DID generated: ${did}`);

    const existingUser = await User.findOne({
      $or: [
        { walletAddress: normalized },
        { did },
      ],
    });
    if (existingUser) {
      console.log(`[registerWallet] Existing user found in User collection for ${normalized}, logging in`);
      const token = generateToken(existingUser);
      return res.json({ success: true, token, user: formatUserResponse(existingUser) });
    }

    // Also check role-specific collections for existing wallet
    const existingStudent = await Student.findOne({ walletAddress: normalized });
    const existingTeacher = await Teacher.findOne({ walletAddress: normalized });
    const existingAdmin = await AdminUser.findOne({ walletAddress: normalized });
    if (existingStudent || existingTeacher || existingAdmin) {
      const existing = existingStudent || existingTeacher || existingAdmin;
      console.log(`[registerWallet] Existing user found in ${existing.role} collection for ${normalized}, logging in`);
      const token = generateToken(existing);
      return res.json({ success: true, token, user: formatUserResponse(existing) });
    }

    // Also check role-specific by DID
    if (!existingStudent && !existingTeacher && !existingAdmin) {
      const byDid = await Student.findOne({ did }) || await Teacher.findOne({ did }) || await AdminUser.findOne({ did });
      if (byDid) {
        console.log(`[registerWallet] Existing user found by DID in ${byDid.role} collection, logging in`);
        const token = generateToken(byDid);
        return res.json({ success: true, token, user: formatUserResponse(byDid) });
      }
    }

    // ── 6b. Case-insensitive fallback: catch mismatched-case duplicates ──
    const ciExisting = await User.findOne({
      walletAddress: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (ciExisting && ciExisting.walletAddress !== normalized) {
      console.log(`[registerWallet] Found existing user via case-insensitive check (db="${ciExisting.walletAddress}" vs input="${normalized}"), logging in`);
      const token = generateToken(ciExisting);
      return res.json({ success: true, token, user: formatUserResponse(ciExisting) });
    }

    // ── 7. Create user ──
    const finalName = name || username || `User-${normalized.slice(2, 8)}`;

    console.log(`[registerWallet] Creating User document for ${normalized}`);
    const user = await User.create({
      name: finalName,
      displayName: username || "",
      role,
      walletAddress: normalized,
      did,
      authMethod: "wallet",
      verificationStatus: "pending",
      onboardingCompleted: false,
      approved: role !== "teacher",
    });
    console.log(`[registerWallet] User created: ${user._id} for ${normalized}`);

    // ── 8. Create role-specific record ──
    try {
      let roleRecord = null;
      if (role === "student") {
        roleRecord = await Student.create({
          name: finalName,
          displayName: username || "",
          gmail: `${normalized}@wallet.auth`,
          role: "student",
          walletAddress: normalized,
          did,
        });
        console.log(`[registerWallet] Student record created: ${roleRecord._id}`);
      } else if (role === "teacher") {
        roleRecord = await Teacher.create({
          name: finalName,
          displayName: username || "",
          gmail: `${normalized}@wallet.auth`,
          role: "teacher",
          walletAddress: normalized,
          did,
        });
        console.log(`[registerWallet] Teacher record created: ${roleRecord._id}`);
      } else if (role === "admin") {
        roleRecord = await AdminUser.create({
          name: finalName,
          displayName: username || "",
          gmail: `${normalized}@wallet.auth`,
          role: "admin",
          walletAddress: normalized,
          did,
          approved: true,
        });
        console.log(`[registerWallet] AdminUser record created: ${roleRecord._id}`);
      }
    } catch (roleErr) {
      console.error(`[registerWallet] Failed to create role-specific record for ${normalized}, deleting User:`, roleErr.message);
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({ error: "Failed to save role-specific data. Please try again." });
    }

    const token = generateToken(user);
    console.log(`[registerWallet] Registration complete for ${normalized} role=${role}`);
    res.json({ success: true, token, user: formatUserResponse(user) });
  } catch (err) {
    console.error("[registerWallet] Error:", err);
    if (err.code === 11000) {
      const keyPattern = err.keyPattern ? Object.keys(err.keyPattern) : ["unknown"];
      const keyValue = err.keyValue || {};
      console.error(`[registerWallet] Duplicate key error on fields: ${keyPattern.join(", ")} keyValue:`, keyValue);

      const searchWallet = keyValue.walletAddress || normalized || (req.body?.address || "").toLowerCase().trim();
      const searchDid = keyValue.did || (searchWallet ? generateDID(searchWallet) : "");

      const orConditions = [];
      if (searchWallet) orConditions.push({ walletAddress: searchWallet });
      if (searchDid) orConditions.push({ did: searchDid });

      if (orConditions.length > 0) {
        const recovered = await User.findOne({ $or: orConditions })
          || await Student.findOne({ $or: orConditions })
          || await Teacher.findOne({ $or: orConditions })
          || await AdminUser.findOne({ $or: orConditions });
        if (recovered) {
          console.log(`[registerWallet] Recovery: found existing user ${recovered._id} in ${recovered.constructor.modelName}, logging in`);
          const token = generateToken(recovered);
          return res.json({ success: true, token, user: formatUserResponse(recovered) });
        }
        // Fallback: case-insensitive search (catches mismatched-case stored values)
        if (searchWallet) {
          const ciQuery = { walletAddress: { $regex: new RegExp(`^${searchWallet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } };
          const ciRecovered = await User.findOne(ciQuery)
            || await Student.findOne(ciQuery)
            || await Teacher.findOne(ciQuery)
            || await AdminUser.findOne(ciQuery);
          if (ciRecovered) {
            console.log(`[registerWallet] Recovery (case-insensitive): found existing user ${ciRecovered._id} in ${ciRecovered.constructor.modelName}, logging in`);
            const token = generateToken(ciRecovered);
            return res.json({ success: true, token, user: formatUserResponse(ciRecovered) });
          }
        }
        console.error(`[registerWallet] Recovery FAILED: no document found for wallet=${searchWallet} did=${searchDid}`);
      }

      // gmail conflict = stale unique index from old schema, auto-heal
      if (keyPattern.includes("gmail")) {
        console.error(`[registerWallet] Stale gmail_1 index detected. Attempting to drop...`);
        try {
          await User.collection.dropIndex("gmail_1");
          console.error(`[registerWallet] Stale gmail_1 index dropped. Retrying registration...`);
          const reqName = (req.body?.name || req.body?.username || "").trim() || `User-${normalized.slice(2, 8)}`;
          const retryUser = await User.create({
            name: reqName,
            displayName: req.body?.username || "",
            role: req.body?.role || "student",
            walletAddress: normalized,
            did: generateDID(normalized),
            authMethod: "wallet",
            verificationStatus: "pending",
            onboardingCompleted: false,
            approved: (req.body?.role || "student") !== "teacher",
          });
          const retryToken = generateToken(retryUser);
          return res.json({ success: true, token: retryToken, user: formatUserResponse(retryUser) });
        } catch (dropErr) {
          console.error(`[registerWallet] Failed to fix stale gmail index:`, dropErr.message);
        }
      }

      const field = keyPattern.includes("walletAddress") ? "wallet address" : "account";
      return res.status(409).json({ error: `This ${field} is already registered. Please try logging in instead.` });
    }
    res.status(500).json({ error: "Authentication failed. Please try again." });
  }
}

/**
 * POST /api/auth/siwe/nonce
 * Generate and store a nonce for a wallet address
 */
async function getNonce(req, res) {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const normalized = walletAddress.toLowerCase();
    const nonce = generateNonce();

    await Nonce.create({
      walletAddress: normalized,
      nonce,
      expiresAt: new Date(Date.now() + NONCE_EXPIRY_MS),
    });

    const message = buildSIWEMessage({
      walletAddress: normalized,
      nonce,
    });

    res.json({ nonce, message });
  } catch (err) {
    console.error("getNonce error:", err);
    res.status(500).json({ error: "Failed to generate nonce" });
  }
}

/**
 * POST /api/auth/siwe/verify
 * Verify the signed SIWE message and authenticate the user
 */
async function verifySignature(req, res) {
  try {
    const { walletAddress, signature, role, name, collegeName, institutionName } = req.body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    if (!signature) {
      return res.status(400).json({ error: "Signature is required" });
    }

    const normalized = walletAddress.toLowerCase();

    const nonceDoc = await Nonce.findOne({
      walletAddress: normalized,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!nonceDoc) {
      return res.status(401).json({ error: "No valid nonce found. Request a new one." });
    }

    const message = buildSIWEMessage({
      walletAddress: normalized,
      nonce: nonceDoc.nonce,
    });

    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== normalized) {
        await Nonce.findByIdAndUpdate(nonceDoc._id, { used: true });
        return res.status(401).json({ error: "Signature does not match wallet address" });
      }
    } catch (sigErr) {
      return res.status(401).json({ error: "Invalid signature format" });
    }

    await Nonce.findByIdAndUpdate(nonceDoc._id, { used: true });

    const did = generateDID(normalized);

    let user = await User.findOne({
      $or: [
        { walletAddress: normalized },
        { did },
      ],
    });

    if (!user) {
      // Check role-specific collections
      user = await Student.findOne({ walletAddress: normalized });
      if (!user) user = await Teacher.findOne({ walletAddress: normalized });
      if (!user) user = await AdminUser.findOne({ walletAddress: normalized });
    }

    if (!user) {
      if (!role || !VALID_ROLES.includes(role)) {
        return res.status(400).json({
          error: "Role selection required",
          needsRole: true,
          walletAddress: normalized,
          did,
        });
      }

      const finalName = name || `User-${normalized.slice(2, 8)}`;

      user = await User.create({
        name: finalName,
        displayName: name || "",
        role,
        walletAddress: normalized,
        did,
        authMethod: "wallet",
        collegeName: collegeName || "",
        institutionName: institutionName || "",
        verificationStatus: role === "admin" ? "verified" : "pending",
        onboardingCompleted: role === "admin" ? true : false,
        approved: role !== "teacher",
      });

      // Create role-specific record
      try {
        if (role === "student") {
          await Student.create({
            name: finalName,
            displayName: name || "",
            gmail: `${normalized}@wallet.auth`,
            role: "student",
            walletAddress: normalized,
            did,
          });
        } else if (role === "teacher") {
          await Teacher.create({
            name: finalName,
            displayName: name || "",
            gmail: `${normalized}@wallet.auth`,
            role: "teacher",
            walletAddress: normalized,
            did,
          });
        } else if (role === "admin") {
          await AdminUser.create({
            name: finalName,
            displayName: name || "",
            gmail: `${normalized}@wallet.auth`,
            role: "admin",
            walletAddress: normalized,
            did,
            approved: true,
          });
        }
      } catch (roleErr) {
        console.error("[verifySignature] Failed to create role record:", roleErr.message);
      }
    } else {
      if (!user.did) user.did = did;
      user.walletAddress = normalized;
      user.authMethod = "wallet";
      await user.save();
    }

    const token = generateToken(user);
    res.json({ token, user: formatUserResponse(user) });
  } catch (err) {
    console.error("verifySignature error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * GET /api/auth/siwe/me
 */
async function getSIWEProfile(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error("getSIWEProfile error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
}

/**
 * POST /api/auth/wallet-login
 */
async function walletLogin(req, res) {
  try {
    const { walletAddress, signature, message, role, name } = req.body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    if (!signature) {
      return res.status(400).json({ error: "Signature is required" });
    }
    if (!message) {
      return res.status(400).json({ error: "Signed message is required" });
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Valid role is required (student, teacher, or admin)" });
    }

    const normalized = walletAddress.toLowerCase();

    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== normalized) {
        return res.status(401).json({ error: "Signature does not match wallet address" });
      }
    } catch (sigErr) {
      return res.status(401).json({ error: "Invalid signature format" });
    }

    const did = generateDID(normalized);

    let user = await User.findOne({
      $or: [
        { walletAddress: normalized },
        { did },
      ],
    });

    if (!user) {
      // Check role-specific collections
      user = await Student.findOne({ walletAddress: normalized });
      if (!user) user = await Teacher.findOne({ walletAddress: normalized });
      if (!user) user = await AdminUser.findOne({ walletAddress: normalized });
    }

    if (!user) {
      return res.status(404).json({ error: "Wallet not registered. Please register first." });
    }

    if (!user.did) user.did = did;
    user.walletAddress = normalized;
    user.authMethod = "wallet";
    await user.save();

    const token = generateToken(user);
    res.json({ success: true, token, user: formatUserResponse(user) });
  } catch (err) {
    console.error("walletLogin error:", err.message, "\nStack:", err.stack ? err.stack.split("\n").slice(0,5).join("\n") : "no stack", "\nFull err:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    const detail = process.env.NODE_ENV === "production" ? "Authentication failed" : err.message;
    const stackLines = (err.stack || "").split("\n").slice(0,3).join(" | ");
    res.status(500).json({ error: `[walletLogin] ${detail}`, debug: err.message, stack: stackLines });
  }
}

/**
 * POST /api/auth/check-wallet
 * Check if a wallet address already has an account
 */
async function checkWallet(req, res) {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const normalized = walletAddress.toLowerCase().trim();
    console.log(`[checkWallet] Checking wallet: ${normalized}`);

    // Check User collection
    let user = await User.findOne({ walletAddress: normalized }).lean();
    if (user) {
      console.log(`[checkWallet] Found in User collection: ${user._id} role=${user.role}`);
      return res.json({
        exists: true,
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          role: user.role,
          walletAddress: user.walletAddress,
          avatar: user.avatar,
          did: user.did,
          onboardingCompleted: user.onboardingCompleted || false,
          verificationStatus: user.verificationStatus || "pending",
        },
      });
    }

    // Check role-specific collections
    const student = await Student.findOne({ walletAddress: normalized }).lean();
    if (student) {
      console.log(`[checkWallet] Found in Student collection: ${student._id}`);
      return res.json({
        exists: true,
        user: {
          _id: student._id,
          name: student.name,
          role: "student",
          walletAddress: student.walletAddress,
          onboardingCompleted: false,
        },
      });
    }

    const teacher = await Teacher.findOne({ walletAddress: normalized }).lean();
    if (teacher) {
      console.log(`[checkWallet] Found in Teacher collection: ${teacher._id}`);
      return res.json({
        exists: true,
        user: {
          _id: teacher._id,
          name: teacher.name,
          role: "teacher",
          walletAddress: teacher.walletAddress,
          onboardingCompleted: false,
        },
      });
    }

    const adminUser = await AdminUser.findOne({ walletAddress: normalized }).lean();
    if (adminUser) {
      console.log(`[checkWallet] Found in AdminUser collection: ${adminUser._id}`);
      return res.json({
        exists: true,
        user: {
          _id: adminUser._id,
          name: adminUser.name,
          role: "admin",
          walletAddress: adminUser.walletAddress,
          onboardingCompleted: false,
        },
      });
    }

    // Fallback: case-insensitive search for mismatched-case duplicates
    const ciQuery = { walletAddress: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } };
    const ciUser = await User.findOne(ciQuery).lean()
      || await Student.findOne(ciQuery).lean()
      || await Teacher.findOne(ciQuery).lean()
      || await AdminUser.findOne(ciQuery).lean();
    if (ciUser) {
      console.log(`[checkWallet] Found via case-insensitive fallback: ${ciUser._id} role=${ciUser.role} (db="${ciUser.walletAddress}" vs query="${normalized}")`);
      return res.json({
        exists: true,
        user: {
          _id: ciUser._id,
          name: ciUser.name,
          role: ciUser.role || "student",
          walletAddress: ciUser.walletAddress,
          onboardingCompleted: false,
        },
      });
    }

    console.log(`[checkWallet] Wallet not found: ${normalized}`);
    res.json({ exists: false });
  } catch (err) {
    console.error("[checkWallet] Error:", err);
    res.status(500).json({ error: "Failed to check wallet" });
  }
}

module.exports = {
  getNonce,
  verifySignature,
  getSIWEProfile,
  walletLogin,
  checkWallet,
  getNonceSimple,
  registerWallet,
};
