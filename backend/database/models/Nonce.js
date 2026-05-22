const mongoose = require("mongoose");

const NonceSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
    index: true,
  },
  nonce: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  used: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

NonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Nonce", NonceSchema);
