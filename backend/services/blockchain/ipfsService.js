const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_BASE_URL = "https://api.pinata.cloud";

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
  "https://w3s.link/ipfs",
];

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function checkCredentials() {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error("Pinata API credentials not configured. Set PINATA_API_KEY and PINATA_SECRET_KEY in .env");
  }
}

function getPinataHeaders() {
  return {
    pinata_api_key: PINATA_API_KEY,
    pinata_secret_api_key: PINATA_SECRET_KEY,
  };
}

async function uploadWithRetry(uploadFn, retries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await uploadFn();
      return result;
    } catch (err) {
      lastError = err;
      console.error(`[IPFS] Upload attempt ${attempt}/${retries} failed:`, err.response?.data || err.message);
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[IPFS] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  throw new Error(`IPFS upload failed after ${retries} retries: ${lastError.message}`);
}

async function verifyIPFSHash(cid) {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const url = `${gateway}/${cid}`;
      const response = await axios.head(url, { timeout: 10000 });
      if (response.status >= 200 && response.status < 400) {
        return { verified: true, gateway };
      }
    } catch { /* try next gateway */ }
  }
  return { verified: false, reason: "CID not found on any gateway" };
}

async function uploadFileToIPFS(fileBuffer, fileName) {
  checkCredentials();

  return uploadWithRetry(async () => {
    const formData = new FormData();
    formData.append("file", fileBuffer, {
      filename: fileName,
      contentType: "image/png",
    });
    formData.append("pinataMetadata", JSON.stringify({ name: fileName }));
    formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    console.log(`[IPFS] Uploading file: ${fileName}`);

    const response = await axios.post(
      `${PINATA_BASE_URL}/pinning/pinFileToIPFS`,
      formData,
      {
        maxBodyLength: Infinity,
        timeout: 60000,
        headers: {
          ...formData.getHeaders(),
          ...getPinataHeaders(),
        },
      }
    );

    const ipfsHash = response.data.IpfsHash;
    const ipfsURI = `ipfs://${ipfsHash}`;

    const verification = await verifyIPFSHash(ipfsHash);
    if (!verification.verified) {
      console.warn(`[IPFS] File uploaded but hash verification inconclusive: ${ipfsURI}`);
    }

    console.log(`[IPFS] File uploaded: ${ipfsURI} (verified: ${verification.verified})`);
    return ipfsURI;
  });
}

async function uploadFilePathToIPFS(filePath, fileName) {
  checkCredentials();

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at ${filePath}`);
  }

  return uploadWithRetry(async () => {
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
          ...getPinataHeaders(),
        },
      }
    );

    const ipfsHash = response.data.IpfsHash;
    return `ipfs://${ipfsHash}`;
  });
}

async function uploadMetadataToIPFS(metadata) {
  checkCredentials();

  return uploadWithRetry(async () => {
    console.log(`[IPFS] Uploading metadata JSON: ${metadata.name}`);

    const response = await axios.post(
      `${PINATA_BASE_URL}/pinning/pinJSONToIPFS`,
      {
        pinataContent: metadata,
        pinataMetadata: {
          name: `${metadata.name || "NFT"}-metadata.json`,
        },
        pinataOptions: { cidVersion: 1 },
      },
      {
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          ...getPinataHeaders(),
        },
      }
    );

    const ipfsHash = response.data.IpfsHash;
    const metadataURI = `ipfs://${ipfsHash}`;

    console.log(`[IPFS] Metadata uploaded: ${metadataURI}`);
    return metadataURI;
  });
}

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

async function uploadCertificateToIPFS({ imageBuffer, certificatePath, studentName, communityName, collegeName, certificateId }) {
  let imageURI;
  if (certificatePath) {
    imageURI = await uploadFilePathToIPFS(certificatePath, `${certificateId}.png`);
  } else if (imageBuffer) {
    imageURI = await uploadFileToIPFS(imageBuffer, `${certificateId}.png`);
  } else {
    throw new Error("Either imageBuffer or certificatePath is required");
  }

  const imageHTTPS = convertIPFSToHTTPS(imageURI);
  console.log(`[IPFS] Image IPFS: ${imageURI}`);
  console.log(`[IPFS] Image HTTPS: ${imageHTTPS}`);

  const metadata = {
    name: `Campus Certificate – ${communityName}`,
    description: `NFT Certificate of Achievement awarded to ${studentName} for successfully completing all tasks in the ${communityName} community at ${collegeName}. Issued on the Blockchain Enabled Virtual Campus Platform.`,
    image: imageHTTPS,
    image_url: imageHTTPS,
    external_url: imageHTTPS || "https://virtual-campus.example.com",
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

  const metadataURI = await uploadMetadataToIPFS(metadata);
  const metadataHTTPS = convertIPFSToHTTPS(metadataURI);
  console.log(`[IPFS] Metadata IPFS: ${metadataURI}`);
  console.log(`[IPFS] Metadata HTTPS: ${metadataHTTPS}`);

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
