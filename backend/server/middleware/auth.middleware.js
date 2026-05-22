const jwt = require("jsonwebtoken");
const { findUserByRoleAndId, syncLegacyUserRecord } = require("../utils/userSync");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let authUser = decoded;

    // Resolve live user record by role-aware model and keep legacy mirror synced.
    if (decoded?.id && decoded?.role) {
      const user = await findUserByRoleAndId({
        role: decoded.role,
        userId: decoded.id,
        projection: "-password",
      });

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (user.verificationStatus === "disabled" || user.verificationStatus === "blocked") {
        return res.status(403).json({ error: "Account has been disabled" });
      }

      if (user.collection?.name !== "users") {
        await syncLegacyUserRecord(user);
      }

      authUser = {
        id: user._id.toString(),
        name: user.name,
        walletAddress: user.walletAddress || null,
        did: user.did || null,
        authMethod: user.authMethod || "wallet",
        role: user.role,
        avatar: user.avatar || null,
        approved: user.role === "teacher" ? user.approved !== false : true,
        collegeName: user.collegeName || "",
        phone: user.phone || "",
        fullName: user.fullName || "",
        registrationNumber: user.registrationNumber || "",
        collegeEmail: user.collegeEmail || "",
        collegeIdImage: user.collegeIdImage || null,
        signatureImage: user.signatureImage || null,
        verificationStatus: user.verificationStatus || "pending",
        onboardingCompleted: user.onboardingCompleted || false,
        verificationSubmitted: user.verificationSubmitted || false,
        teacherProfileId: user.teacherProfileId || null,
      };
    }

    req.user = authUser;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = { authMiddleware };
