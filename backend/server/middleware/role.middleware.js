const { findUserByRoleAndId, syncLegacyUserRecord } = require("../utils/userSync");

const authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await findUserByRoleAndId({
        role: req.user?.role,
        userId,
        projection: "-password",
      });

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (user.collection?.name !== "users") {
        await syncLegacyUserRecord(user);
      }

      req.user = user;
      return next();
    } catch (err) {
      return res.status(500).json({ error: "Role authorization failed" });
    }
  };
};

const teacherApprovedAuth = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await findUserByRoleAndId({
      role: req.user?.role,
      userId,
      projection: "-password",
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const allowedRoles = ["teacher", "community_manager"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Only teachers or community managers can perform this action" });
    }

    if (user.role === "teacher") {
      const isApprovedTeacher = user.approved !== false;
      if (!isApprovedTeacher) {
        return res.status(403).json({
          error: "Teacher account is pending admin approval",
          code: "TEACHER_PENDING_APPROVAL",
        });
      }
    }

    if (user.collection?.name !== "users") {
      await syncLegacyUserRecord(user);
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(500).json({ error: "Teacher authorization failed" });
  }
};

module.exports = { authorizeRoles, teacherApprovedAuth };
