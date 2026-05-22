const jwt = require("jsonwebtoken");
const { findUserByRoleAndId, syncLegacyUserRecord } = require("../utils/userSync");

const ELEVATED_ROLES = ["admin", "teacher", "community_manager"];
const ADMIN_ONLY = ["admin"];

/**
 * Elevated auth — allows admin, teacher, community_manager
 * Use for management routes (community edits, member mgmt, etc.)
 */
const elevatedAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await findUserByRoleAndId({
      role: decoded.role,
      userId: decoded.id,
      projection: "-password",
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (!ELEVATED_ROLES.includes(user.role)) {
      return res.status(403).json({ error: "Access denied. Elevated role required." });
    }

    if (user.collection?.name !== "users") {
      await syncLegacyUserRecord(user);
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Strict admin-only — allows only admin role
 * Use for sensitive routes (approve/reject teachers, delete communities, etc.)
 */
const adminOnly = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await findUserByRoleAndId({
      role: decoded.role,
      userId: decoded.id,
      projection: "-password",
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (!ADMIN_ONLY.includes(user.role)) {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    if (user.collection?.name !== "users") {
      await syncLegacyUserRecord(user);
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = { elevatedAuth, adminOnly };
