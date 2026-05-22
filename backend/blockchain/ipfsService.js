// ─────────────────────────────────────────────────────────────
// IPFS Service — Certificate & Metadata Upload to IPFS
// ─────────────────────────────────────────────────────────────
// This service handles uploading certificate images and NFT
// metadata to IPFS using Pinata (a popular IPFS pinning service).
//
// WORKFLOW:
// 1. The certificate image (PNG buffer) is uploaded to Pinata.
// 2. Pinata pins the file and returns an IPFS CID (content hash).
// 3. NFT metadata JSON is created following the ERC721 standard,
//    with the image field pointing to the IPFS image URI.
// 4. The metadata JSON is also uploaded to Pinata.
// 5. The final metadata URI (ipfs://...) is returned for use
//    in the smart contract's mintCertificate function.
//
// SETUP:
// 1. Create a free account at https://www.pinata.cloud
// 2. Generate an API Key and Secret from the Pinata dashboard
// 3. Set PINATA_API_KEY and PINATA_SECRET_KEY in your .env file
// ─────────────────────────────────────────────────────────────

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_BASE_URL = "https://api.pinata.cloud";

/**
 * Upload a file buffer (e.g., certificate PNG) to IPFS via Pinata.
 *
 * @param {Buffer} fileBuffer - The file content as a Buffer
 * @param {string} fileName   - Name for the file on IPFS
 * @returns {string} IPFS URI (ipfs://Qm...)
 */
async function uploadFileToIPFS(fileBuffer, fileName) {
  try {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      throw new Error("Pinata API credentials not configured. Set PINATA_API_KEY and PINATA_SECRET_KEY in .env");
    }

    const formData = new FormData();
    formData.append("file", fileBuffer, {
      filename: fileName,
      contentType: "image/png",
    });

    // Pinata metadata — helps organize files on the dashboard
    const pinataMetadata = JSON.stringify({ name: fileName });
    formData.append("pinataMetadata", pinataMetadata);

    // Pinata options — pin the file so it persists
    const pinataOptions = JSON.stringify({ cidVersion: 1 });
    formData.append("pinataOptions", pinataOptions);

    console.log(`[IPFS Service] Uploading file: ${fileName}`);

    const response = await axios.post(
      `${PINATA_BASE_URL}/pinning/pinFileToIPFS`,
      formData,
      {
        maxBodyLength: Infinity,
        timeout: 60000,
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
      }
    );

    const ipfsHash = response.data.IpfsHash;
    const ipfsURI = `ipfs://${ipfsHash}`;

    console.log(`[IPFS Service] File uploaded: ${ipfsURI}`);
    return ipfsURI;
  } catch (error) {
    console.error("[IPFS Service] File upload failed:", error.response?.data || error.message);
    throw new Error(`IPFS file upload failed: ${error.message}`);
  }
}

/**
 * Upload a local file to IPFS via Pinata.
 *
 * @param {string} filePath
 * @param {string} fileName
 * @returns {string} IPFS URI
 */
async function uploadFilePathToIPFS(filePath, fileName) {
  try {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      throw new Error("Pinata API credentials not configured. Set PINATA_API_KEY and PINATA_SECRET_KEY in .env");
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Certificate file not found at ${filePath}`);
    }

    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath), {
      filename: fileName || path.basename(filePath),
      contentType: "image/png",
    });

    formData.append("pinataMetadata", JSON.stringify({ name: fileName || path.basename(filePath) }));
    formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    const response = await axios.post(
      `${PINATA_BASE_URL}/pinning/pinFileToIPFS`,
      formData,
      {
        maxBodyLength: Infinity,
        timeout: 60000,
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
      }
    );

    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error("[IPFS Service] File path upload failed:", error.response?.data || error.message);
    throw new Error(`IPFS file upload failed: ${error.message}`);
  }
}

/**
 * Upload NFT metadata JSON to IPFS via Pinata.
 *
 * The metadata follows the ERC721 Metadata Standard:
 * {
 *   "name": "Certificate Title",
 *   "description": "...",
 *   "image": "ipfs://...",
 *   "attributes": [...]
 * }
 *
 * @param {Object} metadata - The NFT metadata object
 * @returns {string} IPFS URI pointing to the metadata JSON
 */
async function uploadMetadataToIPFS(metadata) {
  try {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      throw new Error("Pinata API credentials not configured. Set PINATA_API_KEY and PINATA_SECRET_KEY in .env");
    }

    console.log("[IPFS Service] Uploading metadata JSON...");

    const response = await axios.post(
      `${PINATA_BASE_URL}/pinning/pinJSONToIPFS`,
      {
        pinataContent: metadata,
        pinataMetadata: {
          name: `${metadata.name || "NFT"}-metadata.json`,
        },
        pinataOptions: {
          cidVersion: 1,
        },
      },
      {
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
      }
    );

    const ipfsHash = response.data.IpfsHash;
    const metadataURI = `ipfs://${ipfsHash}`;

    console.log(`[IPFS Service] Metadata uploaded: ${metadataURI}`);
    return metadataURI;
  } catch (error) {
    console.error("[IPFS Service] Metadata upload failed:", error.response?.data || error.message);
    throw new Error(`IPFS metadata upload failed: ${error.message}`);
  }
}

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
  "https://w3s.link/ipfs",
];

/**
 * Convert IPFS URI to multiple HTTPS gateway URLs for MetaMask compatibility.
 * MetaMask and most browsers need https:// URLs, not ipfs://
 * Returns primary gateway URL; use getAllGatewayUrls() for fallbacks.
 * @param {string} ipfsURI - IPFS URI like ipfs://QmXXX or /ipfs/QmXXX
 * @returns {string} Primary HTTPS gateway URL
 */
function convertIPFSToHTTPS(ipfsURI) {
  if (!ipfsURI) return "";
  if (ipfsURI.startsWith("https://")) return ipfsURI;
  
  let cid;
  if (ipfsURI.startsWith("ipfs://")) {
    cid = ipfsURI.replace("ipfs://", "");
  } else if (ipfsURI.startsWith("/ipfs/")) {
    cid = ipfsURI.replace("/ipfs/", "");
  } else {
    cid = ipfsURI;
  }
  
  return `${IPFS_GATEWAYS[0]}/${cid}`;
}

function extractCID(ipfsURI) {
  if (!ipfsURI) return "";
  if (ipfsURI.startsWith("https://")) {
    const match = ipfsURI.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    return match ? match[1] : ipfsURI;
  }
  if (ipfsURI.startsWith("ipfs://")) return ipfsURI.replace("ipfs://", "");
  if (ipfsURI.startsWith("/ipfs/")) return ipfsURI.replace("/ipfs/", "");
  return ipfsURI;
}

function getAllGatewayUrls(ipfsURI) {
  const cid = extractCID(ipfsURI);
  if (!cid) return [];
  return IPFS_GATEWAYS.map(g => `${g}/${cid}`);
}

/**
 * Complete upload pipeline:
 * 1. Upload certificate image to IPFS
 * 2. Build ERC721 metadata JSON with HTTPS gateway image URL
 * 3. Upload metadata to IPFS
 * 4. Return the final metadata URI for minting (stored as ipfs://) and HTTPS gateway URLs
 *
 * @param {Object} params
 * @param {Buffer} [params.imageBuffer]    - Certificate PNG buffer
 * @param {string} [params.certificatePath] - Local certificate image path
 * @param {string} params.studentName    - Student's full name
 * @param {string} params.communityName  - Community name
 * @param {string} params.collegeName    - College name
 * @param {string} params.certificateId  - Unique certificate identifier
 * @returns {Object} { metadataURI, imageURI, imageHTTPS, metadataHTTPS }
 */
async function uploadCertificateToIPFS({ imageBuffer, certificatePath, studentName, communityName, collegeName, certificateId }) {
  // Step 1: Upload the certificate image
  let imageURI;
  if (certificatePath) {
    imageURI = await uploadFilePathToIPFS(certificatePath, `${certificateId}.png`);
  } else if (imageBuffer) {
    imageURI = await uploadFileToIPFS(imageBuffer, `${certificateId}.png`);
  } else {
    throw new Error("Either imageBuffer or certificatePath is required for certificate upload");
  }

  // Convert to HTTPS gateway URL for MetaMask/browser compatibility
  const imageHTTPS = convertIPFSToHTTPS(imageURI);
  console.log(`[IPFS Service] Image IPFS: ${imageURI}`);
  console.log(`[IPFS Service] Image HTTPS: ${imageHTTPS}`);

  // Step 2: Build ERC721-compliant metadata
  // 🔴 CRITICAL: Use HTTPS gateway URL in the `image` field so MetaMask
  //    can reliably resolve it. MetaMask uses Infura's IPFS nodes which
  //    may not have the content if it hasn't propagated widely.
  //    HTTPS gateway URLs work everywhere without extra configuration.
  const metadata = {
    name: `Campus Certificate – ${communityName}`,
    description: `NFT Certificate of Achievement awarded to ${studentName} for successfully completing all tasks in the ${communityName} community at ${collegeName}. Issued on the Blockchain Enabled Virtual Campus Platform.`,
    image: imageHTTPS,     // ✅ HTTPS — reliably resolvable by MetaMask
    image_url: imageHTTPS, // ✅ HTTPS fallback for other wallets
    external_url: imageHTTPS || (imageURI ? getAllGatewayUrls(imageURI)[0] : "https://virtual-campus.example.com"),
    attributes: [
      { trait_type: "Student", value: studentName },
      { trait_type: "Community", value: communityName },
      { trait_type: "College", value: collegeName },
      { trait_type: "Certificate ID", value: certificateId },
      { trait_type: "Issue Date", value: new Date().toISOString().split("T")[0] },
      { trait_type: "Platform", value: "Blockchain Enabled Virtual Campus" },
      { trait_type: "Network", value: "Polygon Amoy Testnet" },
    ],
  };

  // Step 3: Upload metadata JSON
  const metadataURI = await uploadMetadataToIPFS(metadata);
  const metadataHTTPS = convertIPFSToHTTPS(metadataURI);
  console.log(`[IPFS Service] Metadata IPFS: ${metadataURI}`);
  console.log(`[IPFS Service] Metadata HTTPS: ${metadataHTTPS}`);

  return { metadataURI, imageURI, imageHTTPS, metadataHTTPS };
}

module.exports = {
  uploadFileToIPFS,
  uploadFilePathToIPFS,
  uploadMetadataToIPFS,
  uploadCertificateToIPFS,
  convertIPFSToHTTPS,
  extractCID,
  getAllGatewayUrls,
};
