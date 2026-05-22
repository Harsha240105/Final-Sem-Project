const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Student = require("../../database/models/Student");
const Teacher = require("../../database/models/Teacher");
const AdminUser = require("../../database/models/AdminUser");
const User = require("../../database/models/User");
const { syncLegacyUserRecord } = require("../utils/userSync");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET = process.env.JWT_SECRET;

const ensureDbConnected = (res) => {
  if (mongoose.connection.readyState === 1) return true;
  res.status(503).json({ error: "Database unavailable", code: "DB_UNAVAILABLE" });
  return false;
};

const formatAuthUser = (user) => ({
  id: user._id,
  publicId: user.publicId || null,
  name: user.name,
  did: user.did || null,
  walletAddress: user.walletAddress || null,
  authMethod: user.authMethod || "wallet",
  role: user.role,
  collegeName: user.collegeName || "",
  institutionType: user.institutionType || "",
  institutionName: user.institutionName || "",
  phone: user.phone || "",
  approved: Boolean(user.approved),
  avatar: user.avatar || null,
  fullName: user.fullName || "",
  registrationNumber: user.registrationNumber || "",
  employeeId: user.employeeId || "",
  collegeEmail: user.collegeEmail || "",
  collegeIdImage: user.collegeIdImage || null,
  signatureImage: user.signatureImage || null,
  verificationStatus: user.verificationStatus || "pending",
  onboardingCompleted: user.onboardingCompleted || false,
  createdAt: user.createdAt,
});

const signToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      walletAddress: user.walletAddress,
      did: user.did || null,
      authMethod: "wallet",
      role: user.role,
      avatar: user.avatar || null,
      approved: Boolean(user.approved),
      collegeName: user.collegeName || "",
      institutionType: user.institutionType || "",
      institutionName: user.institutionName || "",
      phone: user.phone || "",
      verificationStatus: user.verificationStatus || "pending",
      onboardingCompleted: user.onboardingCompleted || false,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const getProfile = async (req, res, next) => {
  try {
    if (!ensureDbConnected(res)) return;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let user = null;
    if (userRole === "student") user = await Student.findById(userId);
    else if (userRole === "teacher") user = await Teacher.findById(userId);
    else if (userRole === "admin") user = await AdminUser.findById(userId);
    if (!user) user = await User.findById(userId);

    if (!user) return res.status(404).json({ error: "User not found" });
    await syncLegacyUserRecord(user);

    return res.status(200).json({
      data: {
        ...formatAuthUser(user),
        walletAddress: user.walletAddress || null,
        did: user.did || null,
        managedCommunity: user.managedCommunity || null,
      },
    });
  } catch (err) {
    return next(err);
  }
};

const updateWallet = async (req, res, next) => {
  try {
    if (!ensureDbConnected(res)) return;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { walletAddress } = req.body;
    let normalizedWallet = null;

    if (walletAddress && typeof walletAddress === "string") {
      const addrRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!addrRegex.test(walletAddress)) {
        return res.status(400).json({ error: "Invalid Ethereum wallet address" });
      }
      normalizedWallet = walletAddress.trim().toLowerCase();
    } else if (walletAddress !== null && walletAddress !== undefined && walletAddress !== "") {
      return res.status(400).json({ error: "Invalid wallet address format" });
    }

    const updateData = normalizedWallet ? { walletAddress: normalizedWallet } : { walletAddress: null };
    let user = null;

    if (userRole === "student") user = await Student.findByIdAndUpdate(userId, updateData, { new: true });
    else if (userRole === "teacher") user = await Teacher.findByIdAndUpdate(userId, updateData, { new: true });
    else if (userRole === "admin") user = await AdminUser.findByIdAndUpdate(userId, updateData, { new: true });
    if (!user) user = await User.findByIdAndUpdate(userId, updateData, { new: true });

    if (!user) return res.status(404).json({ error: "User not found" });
    await syncLegacyUserRecord(user);

    return res.status(200).json({ message: "Wallet address updated", data: { id: user._id, walletAddress: user.walletAddress } });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getProfile,
  updateWallet,
};
