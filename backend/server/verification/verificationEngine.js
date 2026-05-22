const path = require("path");
const fs = require("fs");
const User = require("../../database/models/User");
const { runOcr } = require("./ocrEngine");
const { verifyFormData } = require("./matchingEngine");
const {
  sendVerificationSuccessEmail,
  sendVerificationFailEmail,
  sendEmailNameMismatchEmail,
  sendTeacherPendingApprovalEmail,
} = require("../notifications/emailService");
const {
  sendVerificationSuccessSms,
  sendVerificationFailSms,
  sendTeacherPendingApprovalSms,
} = require("../notifications/smsService");

const uploadsBase = path.join(__dirname, "..", "uploads");

async function runVerification(userId) {
  const user = await User.findById(userId);
  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Admins auto-approved (no AI OCR check)
  if (user.role === "admin") {
    user.verificationStatus = "verified";
    await user.save();
    console.log(`[VERIFY] ✅ ${user.role} ${user.fullName || user.name} auto-approved (no AI required)`);
    const emailTarget = user.collegeEmail || user.gmail || user.email;
    if (emailTarget) {
      await sendVerificationSuccessEmail(emailTarget, user.fullName || user.name, user.role);
    } else if (user.phone) {
      await sendVerificationSuccessSms(user.phone, user.fullName || user.name, user.role);
    }
    return {
      success: true,
      verified: true,
      score: 1,
      summary: `Auto-approved (admin role — AI verification not required)`,
      checks: [],
      ocrConfidence: 0,
    };
  }

  // Teachers: form submitted, pending admin approval (no AI OCR)
  if (user.role === "teacher") {
    user.verificationStatus = "pending_approval";
    user.approved = false;
    await user.save();
    console.log(`[VERIFY] ⏳ Teacher ${user.fullName || user.name} form submitted — pending admin approval`);
    const emailTarget = user.collegeEmail || user.gmail || user.email;
    if (emailTarget) {
      await sendTeacherPendingApprovalEmail(emailTarget, user.fullName || user.name);
    } else if (user.phone) {
      await sendTeacherPendingApprovalSms(user.phone, user.fullName || user.name);
    }
    return {
      success: true,
      verified: false,
      pendingApproval: true,
      score: 0,
      summary: `Teacher form submitted — pending admin approval. You will be notified when an admin reviews your application.`,
      checks: [],
      ocrConfidence: 0,
    };
  }

  // Student: AI OCR-based verification
  const collegeIdPath = user.collegeIdImage;
  if (!collegeIdPath) {
    const reason = "No college ID image uploaded";
    await handleVerificationFailure(user, { summary: reason, emailNameMismatch: false, phoneValid: true });
    return { success: false, verified: false, error: reason };
  }

  const fullImagePath = path.join(__dirname, "..", collegeIdPath.replace(/^\//, ""));
  let resolvedPath;
  if (fs.existsSync(fullImagePath)) {
    resolvedPath = fullImagePath;
  } else {
    const altPath = path.join(uploadsBase, "ids", path.basename(collegeIdPath));
    if (!fs.existsSync(altPath)) {
      const reason = "College ID image file not found on disk";
      await handleVerificationFailure(user, { summary: reason, emailNameMismatch: false, phoneValid: true });
      return { success: false, verified: false, error: reason };
    }
    resolvedPath = altPath;
  }

  return runVerificationWithImage(user, resolvedPath);
}

async function runVerificationWithImage(user, imagePath) {
  try {
    const ocrResult = await runOcr(imagePath);

    const formData = {
      fullName: user.fullName || user.name || "",
      collegeName: user.collegeName || "",
      registrationNumber: user.registrationNumber || "",
      phoneNumber: user.phone || "",
      collegeEmail: user.collegeEmail || "",
      countryCode: user.countryCode || "",
    };

    const matchResult = verifyFormData(formData, ocrResult.fields);
    matchResult.ocrConfidence = ocrResult.confidence;
    matchResult.ocrRawText = ocrResult.rawText;

    // Email name mismatch: hard reject with specific email notification
    if (matchResult.emailNameMismatch) {
      await handleEmailNameMismatch(user, matchResult);
      return {
        success: true,
        verified: false,
        score: 0,
        summary: matchResult.summary,
        checks: matchResult.checks,
        ocrConfidence: ocrResult.confidence,
      };
    }

    if (matchResult.verified) {
      await handleVerificationSuccess(user, matchResult);
    } else {
      await handleVerificationFailure(user, matchResult);
    }

    return {
      success: true,
      verified: matchResult.verified,
      score: matchResult.overallScore,
      summary: matchResult.summary,
      checks: matchResult.checks,
      ocrConfidence: ocrResult.confidence,
    };
  } catch (err) {
    console.error(`[VERIFY] Engine error for ${user.walletAddress}:`, err.message);
    user.verificationStatus = "error";
    user.verificationError = err.message;
    await user.save();
    return { success: false, verified: false, error: err.message };
  }
}

async function handleEmailNameMismatch(user, matchResult) {
  const reason = matchResult.summary || "Your email name does not match your registered name";
  user.verificationStatus = "rejected";
  user.verificationError = reason;
  await user.save();

  console.log(
    `[VERIFY] ❌ ${user.role} ${user.fullName || user.name} rejected — email name mismatch`
  );

  const emailTarget = user.collegeEmail || user.gmail || user.email;
  if (emailTarget) {
    await sendEmailNameMismatchEmail(
      emailTarget,
      user.fullName || user.name,
      emailTarget
    );
  }
}

async function handleVerificationSuccess(user, matchResult) {
  user.verificationStatus = "verified";
  await user.save();

  console.log(
    `[VERIFY] ✅ ${user.role} ${user.fullName || user.name} verified (score: ${matchResult.overallScore})`
  );

  const emailTarget = user.collegeEmail || user.gmail || user.email;
  if (emailTarget) {
    const emailResult = await sendVerificationSuccessEmail(
      emailTarget,
      user.fullName || user.name,
      user.role
    );
    if (emailResult.sent) {
      console.log(`[VERIFY] 📧 Success email sent to ${emailTarget}`);
    }
  }

  if (user.phone && !emailTarget) {
    const smsResult = await sendVerificationSuccessSms(
      `${user.countryCode || ""} ${user.phone}`,
      user.fullName || user.name,
      user.role
    );
    if (smsResult.sent) {
      console.log(`[VERIFY] 📱 Success SMS sent to ${user.countryCode} ${user.phone}`);
    }
  }

  return { verified: true };
}

async function handleVerificationFailure(user, matchResult) {
  const reason = matchResult.summary || "Details did not match uploaded ID card";

  user.verificationStatus = "rejected";
  user.verificationError = reason;
  await user.save();

  console.log(
    `[VERIFY] ❌ ${user.role} ${user.fullName || user.name} rejected (score: ${matchResult.overallScore})`
  );

  const emailTarget = user.collegeEmail || user.gmail || user.email;
  if (emailTarget) {
    const emailResult = await sendVerificationFailEmail(
      emailTarget,
      user.fullName || user.name,
      reason
    );
    if (emailResult.sent) {
      console.log(`[VERIFY] 📧 Rejection email sent to ${emailTarget}`);
    }
  }

  if (user.phone && !emailTarget) {
    const smsResult = await sendVerificationFailSms(
      `${user.countryCode || ""} ${user.phone}`,
      user.fullName || user.name
    );
    if (smsResult.sent) {
      console.log(`[VERIFY] 📱 Rejection SMS sent to ${user.countryCode} ${user.phone}`);
    }
  }

  return { verified: false };
}

async function verifyExistingUser(userId) {
  return runVerification(userId);
}

module.exports = {
  runVerification,
  verifyExistingUser,
};
