const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");

const SUPPORTED_LANGS = ["eng"];

function normalizeText(text) {
  return text
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractFields(rawText) {
  const text = rawText.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();

  const extracted = {
    name: "",
    college: "",
    registrationNumber: "",
    rawText: rawText,
  };

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const namePatterns = [
    /(?:name|student name|full name|name of the student)[:\s]*([A-Za-z\s.'-]+)/i,
    /^([A-Z][a-z]*\.?(?:\s+[A-Z][a-z]*\.?)+)/,
  ];

  for (const line of lines) {
    for (const pat of namePatterns) {
      const m = line.match(pat);
      if (m && m[1].trim().length > 3) {
        extracted.name = m[1].trim();
        break;
      }
    }
    if (extracted.name) break;
  }

  if (!extracted.name) {
    const likelyName = lines.find(
      (l) => /^[A-Z][a-z]*\.?\s+[A-Z][a-z]*\.?/.test(l) && l.split(/\s+/).length >= 2
    );
    if (likelyName) extracted.name = likelyName;
  }

  const collegePatterns = [
    /(?:college|university|institute|school|academy)[:\s]*([A-Za-z\s.'&-]+)/i,
    /^([A-Za-z\s.'&-]+(?:college|university|institute|school))/i,
  ];

  for (const line of lines) {
    for (const pat of collegePatterns) {
      const m = line.match(pat);
      if (m && m[1].trim().length > 5) {
        extracted.college = m[1].trim();
        break;
      }
    }
    if (extracted.college) break;
  }

  if (!extracted.college) {
    const likelyCollege = lines.find(
      (l) =>
        /college|university|institute|school|academy/i.test(l) &&
        l.length > 10
    );
    if (likelyCollege) extracted.college = likelyCollege;
  }

  const regPatterns = [
    /(?:reg(?:istration)?\s*(?:no|number|id|#)[:\s]*)([A-Za-z0-9/-]+)/i,
    /(?:roll\s*(?:no|number|id|#)[:\s]*)([A-Za-z0-9/-]+)/i,
    /(?:student\s*id[:\s]*)([A-Za-z0-9/-]+)/i,
    /(?:enroll(?:ment)?\s*(?:no|number|id|#)[:\s]*)([A-Za-z0-9/-]+)/i,
    /\b(\d{2}[A-Za-z]{2}\d{2,})\b/i,
    /\b([A-Z]{2}\d{5,})\b/,
  ];

  for (const line of lines) {
    for (const pat of regPatterns) {
      const m = line.match(pat);
      if (m && m[1].trim().length >= 3) {
        extracted.registrationNumber = m[1].trim();
        break;
      }
    }
    if (extracted.registrationNumber) break;
  }

  if (!extracted.registrationNumber) {
    const numLike = lines.find((l) => /\b\d{4,}\b/.test(l) && l.length < 20);
    if (numLike) {
      const m = numLike.match(/\b(\d{4,})\b/);
      if (m) extracted.registrationNumber = m[1];
    }
  }

  return extracted;
}

async function runOcr(imagePath) {
  const fullPath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(__dirname, "..", imagePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Image not found at: ${fullPath}`);
  }

  const stats = fs.statSync(fullPath);
  if (stats.size === 0) {
    throw new Error("Image file is empty");
  }

  const processedPath = await preprocessImage(fullPath);

  const result = await Tesseract.recognize(processedPath, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text") {
        console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  const rawText = result.data.text || "";
  const fields = extractFields(rawText);

  console.log(`[OCR] Raw text: "${rawText.slice(0, 200)}"`);
  console.log(`[OCR] Extracted fields:`, JSON.stringify(fields));
  console.log(`[OCR] Confidence: ${result.data.confidence || 0}%`);

  return {
    rawText,
    fields,
    confidence: result.data.confidence || 0,
    words: result.data.words || [],
  };
}

async function preprocessImage(imagePath) {
  const img = await loadImage(imagePath);
  let w = img.width;
  let h = img.height;

  // Resize if image is very large (Tesseract works best around 2000px)
  const maxDim = 2000;
  if (w > maxDim || h > maxDim) {
    const scale = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  // Grayscale + slight contrast boost
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const boosted = gray < 128 ? Math.max(0, gray - 20) : Math.min(255, gray + 20);
    data[i] = data[i + 1] = data[i + 2] = boosted;
  }
  ctx.putImageData(imageData, 0, 0);

  const outPath = imagePath.replace(/\.\w+$/, "_processed.png");
  const outBuf = canvas.toBuffer("image/png");
  fs.writeFileSync(outPath, outBuf);
  console.log(`[OCR] Preprocessed image saved: ${outPath} (${w}x${h})`);
  return outPath;
}

module.exports = { runOcr, extractFields, normalizeText, preprocessImage };
