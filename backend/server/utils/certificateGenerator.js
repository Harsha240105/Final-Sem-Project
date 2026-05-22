const { createCanvas, loadImage, registerFont } = require("canvas");
const fs = require("fs");
const path = require("path");
const { mkdir, writeFile } = require("fs/promises");
const QRCode = require("qrcode");

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "server", "uploads", "certificates");

const templateCandidates = [
  path.join(rootDir, "certificates", "templates", "certificate-template.png"),
  path.join(rootDir, "certificates", "certificate-template.png"),
  path.join(rootDir, "server", "assets", "certificate-template.png"),
];

const fontCandidates = [
  { path: path.join(rootDir, "certificates", "templates", "fonts", "Montserrat-Bold.ttf"), family: "Montserrat", weight: "bold" },
  { path: path.join(rootDir, "certificates", "templates", "Montserrat-Bold.ttf"), family: "Montserrat", weight: "bold" },
];

const OUTPUT_SCALE = 2; // HD rendering: 2x resolution for crisp output

let fontRegistered = false;
let activeFont = '"Times New Roman", "Georgia", serif';

function resolveTemplatePath() {
  const templatePath = templateCandidates.find((candidate) => fs.existsSync(candidate));
  return templatePath || null;
}

function registerCertificateFonts() {
  if (fontRegistered) return;
  for (const candidate of fontCandidates) {
    try {
      if (fs.existsSync(candidate.path)) {
        registerFont(candidate.path, { family: candidate.family, weight: candidate.weight });
        activeFont = `bold ${candidate.weight === "bold" ? "" : ""} ${candidate.family}`;
        console.log(`[CertGen] Registered font: ${candidate.family} from ${candidate.path}`);
        fontRegistered = true;
        return;
      }
    } catch (e) {
      console.warn(`[CertGen] Font registration failed for ${candidate.path}: ${e.message}`);
    }
  }
  activeFont = '"Times New Roman", "Georgia", serif';
  console.log("[CertGen] No custom font found, using system fallback");
  fontRegistered = true;
}

function getFontString(px, bold = true) {
  return `${bold ? "bold " : ""}${px * OUTPUT_SCALE}px ${activeFont}`;
}

function safeFilePart(value) {
  return String(value)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

function validateInput(payload) {
  const requiredFields = ["studentName", "communityName", "collegeName", "certificateId"];
  const missing = requiredFields.filter((field) => !String(payload[field] || "").trim());
  if (missing.length > 0) {
    throw new Error(`Missing required certificate fields: ${missing.join(", ")}`);
  }
}

function drawWrappedCenteredText(ctx, text, x, y, maxWidth, lineHeight = 58) {
  const content = String(text || "").trim();
  if (!content) return;

  const words = content.split(/\s+/);
  const lines = [];
  let line = words[0] || "";

  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${line} ${words[index]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = words[index];
    }
  }

  if (line) lines.push(line);

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((currentLine, index) => {
    ctx.fillText(currentLine, x, startY + index * lineHeight);
  });
}

/**
 * Generate QR code as image buffer
 * QR code links to verification page
 */
async function generateQRCode(certificateId, verificationUrl) {
  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 200,
      margin: 2,
    });
    return qrDataUrl;
  } catch (err) {
    console.error("QR code generation error:", err);
    return null;
  }
}

/**
 * Draw QR code on canvas
 * Placed at bottom-right corner
 */
async function drawQRCodeOnCanvas(ctx, certificateId, canvasWidth, canvasHeight, verificationUrl) {
  try {
    const qrDataUrl = await generateQRCode(certificateId, verificationUrl);
    if (!qrDataUrl) return;

    const qrImage = await loadImage(qrDataUrl);
    const qrSize = 120 * OUTPUT_SCALE;
    const padding = 20 * OUTPUT_SCALE;
    const qrX = canvasWidth - qrSize - padding;
    const qrY = canvasHeight - qrSize - padding;

    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  } catch (err) {
    console.error("drawQRCodeOnCanvas error:", err);
  }
}

/**
 * Generate a certificate PNG from the Canva template and save it to disk.
 * Includes QR code in bottom-right corner linking to verification page.
 *
 * @param {Object} params
 * @param {string} params.studentName
 * @param {string} params.communityName
 * @param {string} params.collegeName
 * @param {string} params.certificateId
 * @returns {Promise<string>} Absolute certificate PNG path
 */
async function generateCertificate({
  studentName,
  communityName,
  collegeName,
  certificateId,
}) {
  validateInput({ studentName, communityName, collegeName, certificateId });

  registerCertificateFonts();

  const templatePath = resolveTemplatePath();
  let baseWidth = 1600, baseHeight = 1100;

  // HD canvas: 2x resolution for crisp rendering
  const W = baseWidth * OUTPUT_SCALE;
  const H = baseHeight * OUTPUT_SCALE;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Draw template if available
  if (templatePath) {
    try {
      const templateImage = await loadImage(templatePath);
      ctx.drawImage(templateImage, 0, 0, W, H);
    } catch (e) {
      console.warn(`[CertGen] Template load failed, using fallback: ${e.message}`);
      drawFallbackBackground(ctx, W, H);
    }
  } else {
    drawFallbackBackground(ctx, W, H);
  }

  // Student name — large, centered
  ctx.font = getFontString(52);
  ctx.fillStyle = "#6445af";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawWrappedCenteredText(ctx, studentName, W / 2, H * 0.455, W * 0.62, 58 * OUTPUT_SCALE);

  // Community name
  ctx.fillStyle = "#1e1b4b";
  drawWrappedCenteredText(ctx, communityName, W / 2, H * 0.635, W * 0.70, 58 * OUTPUT_SCALE);

  // Footer
  ctx.font = getFontString(24, false);
  ctx.fillStyle = "#333333";
  const footerY = H * 0.87;
  const footerMargin = 40 * OUTPUT_SCALE;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`Issued by: ${collegeName}`, footerMargin, footerY);
  ctx.textAlign = "right";
  ctx.fillText(`ID: ${certificateId}`, W - footerMargin, footerY);

  // QR code
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verificationUrl = `${frontendUrl}/verify/${certificateId}`;
  await drawQRCodeOnCanvas(ctx, certificateId, W, H, verificationUrl);

  await mkdir(outputDir, { recursive: true });

  const outputFileName = `certificate-${safeFilePart(certificateId)}-${Date.now()}.png`;
  const certificatePath = path.join(outputDir, outputFileName);

  await writeFile(certificatePath, canvas.toBuffer("image/png"));
  console.log(`[CertGen] Saved HD certificate: ${certificatePath} (${W}x${H})`);
  return certificatePath;
}

function drawFallbackBackground(ctx, W, H) {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#f0f4ff");
  gradient.addColorStop(0.5, "#ffffff");
  gradient.addColorStop(1, "#eef2ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Decorative border
  ctx.strokeStyle = "#6445af";
  ctx.lineWidth = 6 * OUTPUT_SCALE;
  ctx.strokeRect(20 * OUTPUT_SCALE, 20 * OUTPUT_SCALE, W - 40 * OUTPUT_SCALE, H - 40 * OUTPUT_SCALE);

  // Inner border
  ctx.strokeStyle = "#c7b3ff";
  ctx.lineWidth = 2 * OUTPUT_SCALE;
  ctx.strokeRect(35 * OUTPUT_SCALE, 35 * OUTPUT_SCALE, W - 70 * OUTPUT_SCALE, H - 70 * OUTPUT_SCALE);

  // Title
  ctx.font = getFontString(36, true);
  ctx.fillStyle = "#1e1b4b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Certificate of Achievement", W / 2, H * 0.18);

  // Decorative line
  ctx.beginPath();
  ctx.moveTo(W * 0.3, H * 0.23);
  ctx.lineTo(W * 0.7, H * 0.23);
  ctx.strokeStyle = "#6445af";
  ctx.lineWidth = 2 * OUTPUT_SCALE;
  ctx.stroke();
}

module.exports = {
  generateCertificate,
};

module.exports.default = generateCertificate;
