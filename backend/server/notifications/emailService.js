const nodemailer = require("nodemailer");

function getTransporter() {
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });
}

async function sendEmail({ to, subject, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log("[EMAIL] SMTP not configured — skipping email send");
    return { sent: false, reason: "SMTP not configured" };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "oxkpixel@gmail.com";

  try {
    await transporter.sendMail({ from, to, subject, html });
    console.log(`[EMAIL] Sent to ${to}: "${subject}"`);
    return { sent: true };
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

async function sendVerificationSuccessEmail(userEmail, userName, role) {
  return sendEmail({
    to: userEmail,
    subject: "Web3Connect — Account Verified Successfully",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a1a; color: #e0e0e0; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a4a;">
        <div style="background: linear-gradient(135deg, #6C5CE7, #00D1FF); padding: 32px 24px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 8px;">✅</div>
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Verification Successful</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #aaa; font-size: 14px;">Dear <strong style="color: #fff;">${userName}</strong>,</p>
          <p style="color: #aaa; font-size: 14px;">Your ${role} account has been <strong style="color: #00D1FF;">verified successfully</strong>.</p>
          <div style="background: #12122a; border: 1px solid #2a2a4a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #00D1FF; font-size: 13px; margin: 0;">✓ Verified ${role === "student" ? "Student" : "Teacher"} Badge</p>
            <p style="color: #888; font-size: 12px; margin: 4px 0 0;">You can now access all features on Web3Connect.</p>
          </div>
          <p style="color: #666; font-size: 12px;">If you have any questions, please contact support.</p>
        </div>
      </div>
    `,
  });
}

async function sendVerificationFailEmail(userEmail, userName, reason) {
  return sendEmail({
    to: userEmail,
    subject: "Web3Connect — Verification Failed",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a1a; color: #e0e0e0; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a4a;">
        <div style="background: linear-gradient(135deg, #ff4444, #ff6b6b); padding: 32px 24px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 8px;">❌</div>
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Verification Failed</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #aaa; font-size: 14px;">Dear <strong style="color: #fff;">${userName}</strong>,</p>
          <p style="color: #aaa; font-size: 14px;">Your verification could not be completed because:</p>
          <div style="background: #2a0a0a; border: 1px solid #4a2a2a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #ff6b6b; font-size: 13px; margin: 0;">${reason || "The provided details did not match your uploaded ID card."}</p>
          </div>
          <p style="color: #aaa; font-size: 14px;">Please try again with correct information or contact support.</p>
        </div>
      </div>
    `,
  });
}

async function sendEmailNameMismatchEmail(userEmail, userName, emailUsed) {
  return sendEmail({
    to: userEmail,
    subject: "Web3Connect — Email Name Mismatch Detected",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a1a; color: #e0e0e0; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a4a;">
        <div style="background: linear-gradient(135deg, #ff6b35, #ff4444); padding: 32px 24px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 8px;">⚠️</div>
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Name & Email Mismatch</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #aaa; font-size: 14px;">Dear <strong style="color: #fff;">${userName}</strong>,</p>
          <p style="color: #aaa; font-size: 14px;">Your verification could not be completed because the name on your college email does not match your registered name.</p>
          <div style="background: #2a0a0a; border: 1px solid #4a2a2a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #ff6b6b; font-size: 13px; margin: 0;">Registered name: <strong style="color: #fff;">${userName}</strong></p>
            <p style="color: #ff6b6b; font-size: 13px; margin: 8px 0 0;">Your email: <strong style="color: #fff;">${emailUsed}</strong></p>
          </div>
          <p style="color: #aaa; font-size: 14px;">Please ensure you use the college email that matches your registered name. Try again with the correct email address.</p>
          <p style="color: #666; font-size: 12px; margin-top: 16px;">If you believe this is a mistake, contact support with your registered name and college email.</p>
        </div>
      </div>
    `,
  });
}

async function sendTeacherPendingApprovalEmail(userEmail, userName) {
  return sendEmail({
    to: userEmail,
    subject: "Web3Connect — Teacher Application Submitted",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a1a; color: #e0e0e0; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a4a;">
        <div style="background: linear-gradient(135deg, #6C5CE7, #00D1FF); padding: 32px 24px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 8px;">📋</div>
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Application Submitted</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #aaa; font-size: 14px;">Dear <strong style="color: #fff;">${userName}</strong>,</p>
          <p style="color: #aaa; font-size: 14px;">Your teacher application has been <strong style="color: #00D1FF;">submitted successfully</strong>.</p>
          <div style="background: #12122a; border: 1px solid #2a2a4a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #ffd700; font-size: 13px; margin: 0;">⏳ Pending Admin Review</p>
            <p style="color: #888; font-size: 12px; margin: 8px 0 0;">An admin will review your application shortly. You will be notified via email once a decision is made.</p>
          </div>
          <p style="color: #666; font-size: 12px;">If you have any questions, please contact your college administrator.</p>
        </div>
      </div>
    `,
  });
}

async function sendTeacherApprovedEmail(userEmail, userName) {
  return sendEmail({
    to: userEmail,
    subject: "Web3Connect — Teacher Application Approved",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a1a; color: #e0e0e0; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a4a;">
        <div style="background: linear-gradient(135deg, #00b894, #00D1FF); padding: 32px 24px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 8px;">✅</div>
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Application Approved</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #aaa; font-size: 14px;">Dear <strong style="color: #fff;">${userName}</strong>,</p>
          <p style="color: #aaa; font-size: 14px;">Your teacher application has been <strong style="color: #00D1FF;">approved</strong> by the admin.</p>
          <div style="background: #0a1a0a; border: 1px solid #2a4a2a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #00D1FF; font-size: 13px; margin: 0;">✓ Teacher Verified</p>
            <p style="color: #888; font-size: 12px; margin: 8px 0 0;">You now have full access to create courses, issue NFTs, and manage your classroom.</p>
          </div>
          <p style="color: #aaa; font-size: 14px;">Log in to your account to get started.</p>
        </div>
      </div>
    `,
  });
}

async function sendTeacherRejectedEmail(userEmail, userName) {
  return sendEmail({
    to: userEmail,
    subject: "Web3Connect — Teacher Application Not Approved",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a1a; color: #e0e0e0; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a4a;">
        <div style="background: linear-gradient(135deg, #ff4444, #ff6b6b); padding: 32px 24px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 8px;">❌</div>
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Application Not Approved</h1>
        </div>
        <div style="padding: 24px;">
          <p style="color: #aaa; font-size: 14px;">Dear <strong style="color: #fff;">${userName}</strong>,</p>
          <p style="color: #aaa; font-size: 14px;">Your teacher application could not be approved at this time.</p>
          <p style="color: #aaa; font-size: 14px;">If you believe this is a mistake, please contact your college administrator for further assistance.</p>
        </div>
      </div>
    `,
  });
}

module.exports = {
  sendEmail,
  sendVerificationSuccessEmail,
  sendVerificationFailEmail,
  sendEmailNameMismatchEmail,
  sendTeacherPendingApprovalEmail,
  sendTeacherApprovedEmail,
  sendTeacherRejectedEmail,
};
