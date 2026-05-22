// ─────────────────────────────────────────────────────────────
// Contract Address Configuration
// ─────────────────────────────────────────────────────────────
// This file stores the deployed smart contract address on the
// Polygon Amoy Testnet. The contract was deployed via Remix IDE
// and implements an ERC721 NFT certificate minting function:
//
//   function mintCertificate(address student, string memory tokenURI)
//
// Replace the address below with your actual deployed contract address.
// ─────────────────────────────────────────────────────────────

if (!process.env.CONTRACT_ADDRESS) {
  console.warn("⚠️  CONTRACT_ADDRESS not set. NFT minting will be disabled.");
}
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";

module.exports = { CONTRACT_ADDRESS };
