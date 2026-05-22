const User = require("../../database/models/User");
const Teacher = require("../../database/models/Teacher");
const { findUserByAnyId } = require("../utils/userSync");
const { runVerification } = require("../verification/verificationEngine");

async function submitVerification(req, res) {
  try {
    const { walletAddress, role, fullName, collegeName, registrationNumber, employeeId, phoneNumber, collegeEmail, countryCode, gmail } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates = {
      fullName: fullName || user.name,
      collegeName: collegeName || user.collegeName,
      phone: phoneNumber || user.phone,
      countryCode: countryCode || user.countryCode || "",
      gmail: gmail || user.gmail || "",
      collegeEmail: collegeEmail || "",
      registrationNumber: registrationNumber || "",
      employeeId: employeeId || user.employeeId || "",
    };

    if (req.files?.collegeId) {
      updates.collegeIdImage = `/uploads/ids/${req.files.collegeId[0].filename}`;
    }

    if (req.files?.signature) {
      updates.signatureImage = `/uploads/signatures/${req.files.signature[0].filename}`;
    }

    Object.assign(user, updates);

    user.verificationError = null;

    // Set status synchronously based on role
    if (user.role === "teacher") {
      user.verificationStatus = "pending_approval";
      user.verificationSubmitted = true;

      // Also save form data to Teacher collection
      const teacherUpdates = {
        fullName: updates.fullName,
        collegeName: updates.collegeName,
        employeeId: updates.employeeId,
        collegeEmail: updates.collegeEmail,
        phone: updates.phone,
        countryCode: updates.countryCode,
        verificationSubmitted: true,
        approvalStatus: "pending",
      };
      if (updates.collegeIdImage) teacherUpdates.collegeIdImage = updates.collegeIdImage;
      if (updates.signatureImage) teacherUpdates.signatureImage = updates.signatureImage;

      const teacherDoc = await Teacher.findOneAndUpdate(
        { walletAddress: user.walletAddress },
        { $set: teacherUpdates },
        { upsert: true, new: true }
      );
      user.teacherProfileId = teacherDoc._id;
    } else if (user.role === "admin") {
      user.verificationStatus = "verified";
    } else {
      user.verificationStatus = "pending";
      user.verificationSubmitted = true;
    }
    await user.save();

    runVerification(user._id).then((result) => {
      console.log(`[VERIFY] Auto-verification complete for ${walletAddress}:`, result.verified ? "VERIFIED" : "REJECTED");
    }).catch((err) => {
      console.error(`[VERIFY] Auto-verification error for ${walletAddress}:`, err.message);
    });

    const token = require("jsonwebtoken").sign(
      {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
        did: user.did,
        authMethod: "wallet",
        verificationStatus: user.verificationStatus,
        onboardingCompleted: user.onboardingCompleted,
        verificationSubmitted: user.verificationSubmitted,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Verification submitted. AI verification in progress.",
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
        did: user.did,
        verificationStatus: user.verificationStatus,
        onboardingCompleted: user.onboardingCompleted,
        verificationSubmitted: user.verificationSubmitted,
      },
    });
  } catch (err) {
    console.error("submitVerification error:", err);
    res.status(500).json({ error: "Failed to submit verification" });
  }
}

async function getVerificationStatus(req, res) {
  try {
    const user = await User.findById(req.user.id).select(
      "verificationStatus verificationSubmitted onboardingCompleted role fullName collegeEmail employeeId verificationError"
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      verificationStatus: user.verificationStatus,
      verificationSubmitted: user.verificationSubmitted || false,
      onboardingCompleted: user.onboardingCompleted,
      role: user.role,
      fullName: user.fullName,
      collegeEmail: user.collegeEmail,
      employeeId: user.employeeId,
      verificationError: user.verificationError,
    });
  } catch (err) {
    console.error("getVerificationStatus error:", err);
    res.status(500).json({ error: "Failed to get verification status" });
  }
}

async function saveSignature(req, res) {
  try {
    const { walletAddress, signatureData } = req.body;
    if (!walletAddress || !signatureData) {
      return res.status(400).json({ error: "Wallet address and signature data are required" });
    }

    const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const fs = require("fs");
    const path = require("path");
    const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, "");
    const filename = `sig-${walletAddress.slice(0, 10)}-${Date.now()}.png`;
    const filepath = path.join(__dirname, "..", "uploads", "signatures", filename);

    fs.writeFileSync(filepath, base64Data, "base64");

    user.signatureImage = `/uploads/signatures/${filename}`;
    await user.save();

    res.json({ success: true, signatureImage: user.signatureImage });
  } catch (err) {
    console.error("saveSignature error:", err);
    res.status(500).json({ error: "Failed to save signature" });
  }
}

async function completeOnboarding(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Teachers must be approved by admin before completing onboarding
    if (user.role === "teacher" && user.verificationStatus !== "verified") {
      return res.status(403).json({ error: "Teacher account pending admin approval" });
    }

    user.onboardingCompleted = true;
    await user.save();

    const token = require("jsonwebtoken").sign(
      {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
        did: user.did,
        authMethod: "wallet",
        verificationStatus: user.verificationStatus,
        onboardingCompleted: true,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ success: true, token });
  } catch (err) {
    console.error("completeOnboarding error:", err);
    res.status(500).json({ error: "Failed to complete onboarding" });
  }
}

async function triggerReVerification(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: "User ID not found in token" });
    }

    let user = await User.findById(userId);
    if (!user) {
      user = await findUserByAnyId(userId);
    }
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.verificationStatus = "pending";
    user.verificationError = null;
    await user.save();

    const result = await runVerification(user._id);

    const token = require("jsonwebtoken").sign(
      {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
        did: user.did,
        authMethod: "wallet",
        verificationStatus: user.verificationStatus,
        onboardingCompleted: user.onboardingCompleted,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      result,
      token,
    });
  } catch (err) {
    console.error("re-verify error:", err);
    res.status(500).json({ error: "Re-verification failed" });
  }
}

async function checkVerification(req, res) {
  try {
    const user = await User.findById(req.user.id).select(
      "fullName collegeName registrationNumber employeeId phone collegeEmail verificationStatus verificationError role onboardingCompleted"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      verified: user.verificationStatus === "verified",
      status: user.verificationStatus,
      user: {
        fullName: user.fullName,
        collegeName: user.collegeName,
        registrationNumber: user.registrationNumber,
        employeeId: user.employeeId,
        phone: user.phone,
        collegeEmail: user.collegeEmail,
        role: user.role,
      },
      onboardingCompleted: user.onboardingCompleted,
      error: user.verificationError,
    });
  } catch (err) {
    console.error("checkVerification error:", err);
    res.status(500).json({ error: "Failed to check verification" });
  }
}

async function updateProfile(req, res) {
  try {
    const allowedFields = ["name", "collegeName", "phone", "collegeEmail", "registrationNumber", "employeeId", "bio", "displayName"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    Object.assign(user, updates);
    if (updates.name || updates.collegeName || updates.registrationNumber) {
      user.verificationStatus = "pending";
    }
    await user.save();
    const token = require("jsonwebtoken").sign(
      {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
        did: user.did,
        authMethod: "wallet",
        verificationStatus: user.verificationStatus,
        onboardingCompleted: user.onboardingCompleted,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ success: true, user, token });
  } catch (err) {
    console.error("updateProfile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

module.exports = {
  submitVerification,
  getVerificationStatus,
  saveSignature,
  completeOnboarding,
  triggerReVerification,
  checkVerification,
  updateProfile,
};
