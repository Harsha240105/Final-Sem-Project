const twilio = require("twilio");

function getSmsClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
}

async function sendSms({ to, body }) {
  const client = getSmsClient();
  if (!client) {
    console.log("[SMS] Twilio not configured — skipping SMS");
    return { sent: false, reason: "Twilio not configured" };
  }
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    console.log("[SMS] TWILIO_PHONE_NUMBER not set — skipping SMS");
    return { sent: false, reason: "Sender phone not configured" };
  }
  try {
    await client.messages.create({ from, to, body });
    console.log(`[SMS] Sent to ${to}`);
    return { sent: true };
  } catch (err) {
    console.error(`[SMS] Failed to send to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

async function sendVerificationSuccessSms(phoneNumber, userName, role) {
  return sendSms({
    to: phoneNumber,
    body: `Web3Connect: Your ${role} account has been verified successfully! Welcome, ${userName}.`,
  });
}

async function sendVerificationFailSms(phoneNumber, userName) {
  return sendSms({
    to: phoneNumber,
    body: `Web3Connect: Your account verification failed because the provided details did not match your uploaded ID card. Please try again.`,
  });
}

async function sendTeacherPendingApprovalSms(phoneNumber, userName) {
  return sendSms({
    to: phoneNumber,
    body: `Web3Connect: Your teacher application has been submitted, ${userName}. An admin will review it shortly. You will be notified once a decision is made.`,
  });
}

async function sendTeacherApprovedSms(phoneNumber, userName) {
  return sendSms({
    to: phoneNumber,
    body: `Web3Connect: Your teacher application has been APPROVED, ${userName}! You now have full access to create courses and issue certificates. Welcome aboard!`,
  });
}

async function sendTeacherRejectedSms(phoneNumber, userName) {
  return sendSms({
    to: phoneNumber,
    body: `Web3Connect: Your teacher application could not be approved at this time, ${userName}. Please contact your college administrator for more information.`,
  });
}

module.exports = { sendSms, sendVerificationSuccessSms, sendVerificationFailSms, sendTeacherPendingApprovalSms, sendTeacherApprovedSms, sendTeacherRejectedSms };
