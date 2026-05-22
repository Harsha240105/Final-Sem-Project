const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
  "https://w3s.link/ipfs",
];

export function extractCID(uri) {
  if (!uri) return "";
  if (uri.startsWith("https://")) {
    const m = uri.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    return m ? m[1] : uri;
  }
  if (uri.startsWith("ipfs://")) return uri.replace("ipfs://", "");
  if (uri.startsWith("/ipfs/")) return uri.replace("/ipfs/", "");
  return uri;
}

export function convertIPFSToHTTPS(uri) {
  if (!uri) return "";
  if (uri.startsWith("https://")) return uri;
  const cid = extractCID(uri);
  if (!cid) return "";
  return `${IPFS_GATEWAYS[0]}/${cid}`;
}

export function getAllGatewayUrls(uri) {
  const cid = extractCID(uri);
  if (!cid) return [];
  return IPFS_GATEWAYS.map(g => `${g}/${cid}`);
}

export function getImageUrl(metadata) {
  if (!metadata) return "";
  const candidates = [
    convertIPFSToHTTPS(metadata.image),
    convertIPFSToHTTPS(metadata.image_url),
    convertIPFSToHTTPS(metadata.imageURI),
    convertIPFSToHTTPS(metadata.imageHTTPS),
  ];
  return candidates.find(Boolean) || "";
}
