const { ethers } = require("ethers");
const crypto = require("crypto");

const DID_PREFIX = "did:polygon";
const DID_METHOD = "amoy";

/**
 * Generate a DID for a wallet address
 * Format: did:polygon:amoy:0x...
 */
function generateDID(walletAddress) {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    throw new Error("Invalid wallet address");
  }
  const normalized = walletAddress.toLowerCase();
  return `${DID_PREFIX}:${DID_METHOD}:${normalized}`;
}

/**
 * Generate a DID for a wallet address using a hash-based method
 * for additional privacy
 */
function generateDIDHash(walletAddress) {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    throw new Error("Invalid wallet address");
  }
  const hash = crypto
    .createHash("sha256")
    .update(walletAddress.toLowerCase())
    .digest("hex")
    .slice(0, 16);
  return `${DID_PREFIX}:hash:${hash}`;
}

/**
 * Extract wallet address from a DID
 */
function extractWalletFromDID(did) {
  if (!did || !did.startsWith(DID_PREFIX)) return null;
  const parts = did.split(":");
  if (parts.length < 3) return null;
  const potentialAddress = parts[parts.length - 1];
  if (ethers.isAddress(potentialAddress)) return potentialAddress;
  return null;
}

/**
 * Verify that a DID matches a wallet address
 */
function verifyDIDOwnership(did, walletAddress) {
  const extracted = extractWalletFromDID(did);
  if (!extracted) return false;
  return extracted.toLowerCase() === walletAddress.toLowerCase();
}

module.exports = {
  generateDID,
  generateDIDHash,
  extractWalletFromDID,
  verifyDIDOwnership,
};
