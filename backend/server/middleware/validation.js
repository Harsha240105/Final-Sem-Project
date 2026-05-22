const { body, param, query, validationResult } = require("express-validator");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Validation failed", details: errors.array() });
  }
  next();
}

const walletAddress = body("walletAddress")
  .optional({ nullable: true, checkFalsy: true })
  .trim()
  .custom((value) => {
    if (!value) return true;
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error("Invalid Ethereum wallet address");
    return true;
  });

const objectId = (field = "id") => param(field)
  .isMongoId()
  .withMessage(`Invalid ${field}`);

const name = body("name")
  .trim()
  .notEmpty()
  .isLength({ max: 100 })
  .withMessage("Name is required (max 100 chars)");

const email = body("email")
  .optional({ nullable: true, checkFalsy: true })
  .trim()
  .isEmail()
  .normalizeEmail()
  .withMessage("Invalid email address");

const phone = body("phone")
  .optional({ nullable: true, checkFalsy: true })
  .trim()
  .matches(/^\+?[\d\s\-()]{7,20}$/)
  .withMessage("Invalid phone number");

const message = body("message")
  .optional({ nullable: true, checkFalsy: true })
  .trim()
  .isLength({ max: 2000 })
  .withMessage("Message must be under 2000 characters");

const pagination = [
  query("page").optional().isInt({ min: 1 }).toInt().withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt().withMessage("Limit must be 1-100"),
];

module.exports = {
  handleValidation,
  walletAddress,
  objectId,
  name,
  email,
  phone,
  message,
  pagination,
  validationResult,
};
