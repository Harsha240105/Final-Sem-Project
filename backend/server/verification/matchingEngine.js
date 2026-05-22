const stringSimilarity = require("string-similarity");

const MATCH_THRESHOLD = 0.85;

function normalize(str) {
  return str
    .toString()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const base = stringSimilarity.compareTwoStrings(na, nb);
  const aWords = na.split(/\s+/);
  const bWords = nb.split(/\s+/);
  let wordScore = 0;
  for (const w of aWords) {
    if (w.length < 3) continue;
    const best = bWords.reduce(
      (max, bw) => Math.max(max, stringSimilarity.compareTwoStrings(w, bw)),
      0
    );
    wordScore += best;
  }
  const avgWordScore =
    aWords.filter((w) => w.length >= 3).length > 0
      ? wordScore / aWords.filter((w) => w.length >= 3).length
      : 0;
  return Math.max(base, avgWordScore);
}

function containsSimilar(haystack, needle, minScore = 0.75) {
  const nh = normalize(haystack);
  const nn = normalize(needle);
  if (nh.includes(nn) || nn.includes(nh)) return 1;
  const needleWords = nn.split(/\s+/).filter((w) => w.length >= 3);
  if (needleWords.length === 0) return 0;
  let bestTotal = 0;
  for (const nw of needleWords) {
    let best = 0;
    for (const hw of nh.split(/\s+/)) {
      const s = stringSimilarity.compareTwoStrings(nw, hw);
      if (s > best) best = s;
    }
    bestTotal += best;
  }
  return bestTotal / needleWords.length;
}

function extractNameFromEmail(email) {
  const local = (email || "").split("@")[0] || "";
  return local.replace(/[._-]/g, " ");
}

function validatePhoneWithCountryCode(phoneNumber, countryCode) {
  if (!phoneNumber) return { valid: false, reason: "Phone number is required" };
  const cleaned = phoneNumber.replace(/[\s\-()]/g, "");
  const countryRules = {
    "+1": { name: "US/Canada", pattern: /^\+1\d{10}$/, example: "+1 234 567 8900" },
    "+44": { name: "UK", pattern: /^\+44\d{10}$/, example: "+44 7123 456789" },
    "+91": { name: "India", pattern: /^\+91\d{10}$/, example: "+91 98765 43210" },
    "+61": { name: "Australia", pattern: /^\+61\d{9}$/, example: "+61 412 345 678" },
    "+81": { name: "Japan", pattern: /^\+81\d{10,11}$/, example: "+81 90 1234 5678" },
    "+86": { name: "China", pattern: /^\+86\d{11}$/, example: "+86 138 0013 8000" },
    "+49": { name: "Germany", pattern: /^\+49\d{10,11}$/, example: "+49 170 1234567" },
    "+33": { name: "France", pattern: /^\+49\d{9}$/, example: "+33 6 12 34 56 78" },
    "+82": { name: "South Korea", pattern: /^\+82\d{9,10}$/, example: "+82 10 1234 5678" },
    "+971": { name: "UAE", pattern: /^\+971\d{9}$/, example: "+971 50 123 4567" },
    "+55": { name: "Brazil", pattern: /^\+55\d{10,11}$/, example: "+55 11 91234 5678" },
    "+7": { name: "Russia", pattern: /^\+7\d{10}$/, example: "+7 912 345 67 89" },
    "+92": { name: "Pakistan", pattern: /^\+92\d{10}$/, example: "+92 300 1234567" },
    "+880": { name: "Bangladesh", pattern: /^\+880\d{10}$/, example: "+880 1712 345678" },
    "+234": { name: "Nigeria", pattern: /^\+234\d{10}$/, example: "+234 801 234 5678" },
    "+254": { name: "Kenya", pattern: /^\+254\d{9}$/, example: "+254 712 345678" },
    "+27": { name: "South Africa", pattern: /^\+27\d{9}$/, example: "+27 82 123 4567" },
    "+52": { name: "Mexico", pattern: /^\+52\d{10}$/, example: "+52 55 1234 5678" },
    "+39": { name: "Italy", pattern: /^\+39\d{10}$/, example: "+39 312 345 6789" },
    "+34": { name: "Spain", pattern: /^\+34\d{9}$/, example: "+34 612 345 678" },
  };

  if (!countryCode) { return { valid: false, reason: "Country code is required" }; }

  const rule = countryRules[countryCode];
  if (!rule) {
    if (!cleaned.startsWith(countryCode)) {
      return { valid: false, reason: `Number must start with ${countryCode}` };
    }
    const digits = cleaned.replace(/\D/g, "").length;
    if (digits < 7 || digits > 15) {
      return { valid: false, reason: `Invalid digit count for ${countryCode}` };
    }
    return { valid: true };
  }

  if (!cleaned.startsWith(countryCode)) {
    return { valid: false, reason: `Number must start with ${countryCode}` };
  }
  if (!rule.pattern.test(cleaned)) {
    return { valid: false, reason: `Invalid phone format for ${rule.name}. Expected format: ${rule.example}` };
  }
  return { valid: true };
}

function verifyFormData(formData, ocrFields) {
  const checks = [];

  // 1. Full name vs OCR name on ID card
  let nameScore = similarity(formData.fullName || "", ocrFields.name || "");
  let nameOcrValue = ocrFields.name || "";
  let nameDetail = nameScore >= MATCH_THRESHOLD
    ? "✓ Name matched on ID card"
    : "✗ Name on ID card does not match";

  // Aggressive fallback: scan every line in raw text for the best name match
  if (nameScore < MATCH_THRESHOLD) {
    const lines = (ocrFields.rawText || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let bestLineScore = 0;
    let bestLine = "";
    for (const line of lines) {
      const s = similarity(formData.fullName, line);
      if (s > bestLineScore) { bestLineScore = s; bestLine = line; }
    }
    if (bestLineScore > nameScore) {
      nameScore = bestLineScore;
      nameOcrValue = bestLine.slice(0, 80);
      nameDetail = bestLineScore >= MATCH_THRESHOLD
        ? `✓ Name matched on ID card (line match: ${Math.round(bestLineScore * 100)}%)`
        : `✗ Best line match only ${Math.round(bestLineScore * 100)}% — "${bestLine.slice(0, 60)}"`;
    }
  }

  checks.push({
    field: "fullName",
    label: "Name on ID card",
    formValue: formData.fullName,
    ocrValue: nameOcrValue,
    score: nameScore,
    passed: nameScore >= MATCH_THRESHOLD,
    detail: nameDetail,
  });

  // 2. College name vs OCR on ID card
  const collegeScore =
    formData.collegeName && ocrFields.college
      ? similarity(formData.collegeName, ocrFields.college)
      : 1;
  checks.push({
    field: "collegeName",
    label: "College on ID card",
    formValue: formData.collegeName,
    ocrValue: ocrFields.college,
    score: collegeScore,
    passed: collegeScore >= MATCH_THRESHOLD,
    detail: collegeScore >= MATCH_THRESHOLD
      ? "✓ College matched on ID card"
      : "✗ College name on ID card does not match",
  });

  // 3. Registration number on ID card
  const regScore =
    formData.registrationNumber && ocrFields.registrationNumber
      ? similarity(formData.registrationNumber, ocrFields.registrationNumber)
      : 1;
  checks.push({
    field: "registrationNumber",
    label: "Registration ID on card",
    formValue: formData.registrationNumber,
    ocrValue: ocrFields.registrationNumber,
    score: regScore,
    passed: regScore >= MATCH_THRESHOLD,
    detail: regScore >= MATCH_THRESHOLD
      ? "✓ Registration number matched on ID card"
      : "✗ Registration number on ID card does not match",
  });

  // 4. Raw text contains college name
  const ocrContainsCollege =
    formData.collegeName && ocrFields.rawText
      ? containsSimilar(ocrFields.rawText, formData.collegeName)
      : 1;
  checks.push({
    field: "collegeInRawText",
    label: "College in raw OCR text",
    formValue: formData.collegeName,
    ocrValue: "(raw text search)",
    score: ocrContainsCollege,
    passed: ocrContainsCollege >= MATCH_THRESHOLD,
    detail: ocrContainsCollege >= MATCH_THRESHOLD
      ? "✓ College name found in ID card text"
      : "✗ College name not found in ID card text",
  });

  // 5. Raw text contains full name
  const ocrContainsName =
    formData.fullName && ocrFields.rawText
      ? containsSimilar(ocrFields.rawText, formData.fullName)
      : 1;
  checks.push({
    field: "nameInRawText",
    label: "Name in raw OCR text",
    formValue: formData.fullName,
    ocrValue: "(raw text search)",
    score: ocrContainsName,
    passed: ocrContainsName >= MATCH_THRESHOLD,
    detail: ocrContainsName >= MATCH_THRESHOLD
      ? "✓ Name found in ID card text"
      : "✗ Name not found in ID card text",
  });

  // 6. Email name check (informational only — used for notification targeting, not pass/fail)
  let emailNameMismatch = false;
  let emailNameScore = 1;
  if (formData.collegeEmail && formData.fullName) {
    const emailName = extractNameFromEmail(formData.collegeEmail);
    emailNameScore = similarity(emailName, formData.fullName);
    emailNameMismatch = emailNameScore < 0.5;
    checks.push({
      field: "emailNameMatch",
      label: "Email name vs full name",
      formValue: formData.fullName,
      ocrValue: `Email local part: "${emailName}"`,
      score: emailNameScore,
      passed: true,
      detail: emailNameScore >= 0.5
        ? "✓ Email name matches your registered name"
        : "ℹ Email name differs from registered name — notifications will be sent via email anyway",
    });
  } else {
    checks.push({
      field: "emailNameMatch",
      label: "Email name vs full name",
      formValue: formData.fullName || "",
      ocrValue: formData.collegeEmail || "(no email)",
      score: 1,
      passed: true,
      detail: formData.collegeEmail ? "✓ Email name check skipped" : "ℹ No college email provided — SMS notification will be used",
    });
  }

  // 7. Phone validation with country code
  let phoneValid = true;
  let phoneReason = "";
  if (formData.phoneNumber && formData.countryCode) {
    const phoneCheck = validatePhoneWithCountryCode(formData.phoneNumber, formData.countryCode);
    phoneValid = phoneCheck.valid;
    phoneReason = phoneCheck.reason || "";
    checks.push({
      field: "phoneValidation",
      label: "Phone number validation",
      formValue: `${formData.countryCode} ${formData.phoneNumber}`,
      ocrValue: `Country: ${formData.countryCode}`,
      score: phoneValid ? 1 : 0,
      passed: phoneValid,
      detail: phoneValid
        ? "✓ Phone number valid for selected country"
        : `✗ ${phoneReason}`,
    });
  } else if (formData.phoneNumber && !formData.countryCode) {
    checks.push({
      field: "phoneValidation",
      label: "Phone number validation",
      formValue: formData.phoneNumber,
      ocrValue: "",
      score: 0,
      passed: false,
      detail: "✗ Country code is required for phone number",
    });
  }

  // Critical fields for pass/fail (direct OCR field comparisons, not raw text search)
  const criticalFields = checks.filter((c) =>
    ["fullName"].includes(c.field)
  );
  const passedCritical = criticalFields.filter((c) => c.passed).length;
  const totalCritical = criticalFields.length;

  const allChecks = checks.filter((c) => c.field !== "phoneValidation" && c.field !== "emailNameMatch");
  const phoneCheckResult = checks.find((c) => c.field === "phoneValidation");
  const emailCheckResult = checks.find((c) => c.field === "emailNameMatch");

  // Hard reject if phone invalid and no email provided
  if (!phoneValid && !formData.collegeEmail) {
    return {
      verified: false,
      overallScore: 0,
      checks,
      emailNameMismatch: false,
      phoneValid: false,
      summary: `Rejected: ${phoneReason || "Phone number is invalid for the selected country code."}`,
    };
  }

  // Normal OCR-based critical field check
  const passed = passedCritical >= Math.ceil(totalCritical * 0.66);

  const overallScore =
    checks.reduce((sum, c) => sum + c.score, 0) / checks.length;

  return {
    verified: passed,
    overallScore: Math.round(overallScore * 100) / 100,
    checks,
    emailNameMismatch: false,
    phoneValid,
    summary: passed
      ? `Verified: ${passedCritical}/${totalCritical} critical fields match (score: ${Math.round(overallScore * 100)}%)`
      : `Rejected: Only ${passedCritical}/${totalCritical} critical fields match (score: ${Math.round(overallScore * 100)}%). The name on your ID card could not be matched. Please upload a clearer photo of your ID card.`,
  };
}

module.exports = { verifyFormData, similarity, containsSimilar, normalize, validatePhoneWithCountryCode };
