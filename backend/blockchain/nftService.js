const { ethers } = require("ethers");
const contractABI = require("./contractABI.json");
const { CONTRACT_ADDRESS } = require("./contractAddress");

const POLYGON_AMOY_RPC = process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology";
const provider = new ethers.JsonRpcProvider(POLYGON_AMOY_RPC);
const OWNERSHIP_ABI = ["function owner() view returns (address)"];

let wallet;
let contract;
let transactionHistory = new Map();
const MAX_TX_HISTORY = 100;

function logBlockchainEvent(stage, payload = {}) {
  try {
    console.log(`[NFT Service][${stage}] ${JSON.stringify(payload)}`);
  } catch {
    console.log(`[NFT Service][${stage}]`, payload);
  }
}

function trackTransaction(txHash, state) {
  transactionHistory.set(txHash, { ...state, lastUpdated: new Date() });
  if (transactionHistory.size > MAX_TX_HISTORY) {
    const oldest = transactionHistory.keys().next().value;
    transactionHistory.delete(oldest);
  }
}

function getTransactionState(txHash) {
  return transactionHistory.get(txHash) || null;
}

function normalizePrivateKey(rawPrivateKey) {
  const value = String(rawPrivateKey || "").trim().replace(/^['"]|['"]$/g, "");
  if (/^[a-fA-F0-9]{64}$/.test(value)) return `0x${value}`;
  if (/^0x[a-fA-F0-9]{64}$/.test(value)) return value;
  return null;
}

function ensureContractAddress() {
  if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS)) {
    throw new Error("Invalid or missing CONTRACT_ADDRESS in environment");
  }
  return CONTRACT_ADDRESS;
}

function getReadOnlyContract() {
  return new ethers.Contract(ensureContractAddress(), contractABI, provider);
}

async function getContractOwner() {
  const ownershipContract = new ethers.Contract(ensureContractAddress(), OWNERSHIP_ABI, provider);
  return ownershipContract.owner();
}

function getBlockchainClient() {
  logBlockchainEvent("client:init", {
    contractAddress: CONTRACT_ADDRESS,
    hasWalletPrivateKey: Boolean(process.env.WALLET_PRIVATE_KEY),
  });

  if (wallet && contract) return { wallet, contract };

  const privateKey = normalizePrivateKey(process.env.WALLET_PRIVATE_KEY);
  if (!privateKey) {
    throw new Error("Invalid WALLET_PRIVATE_KEY format. Expected 0x + 64 hexadecimal characters.");
  }

  wallet = new ethers.Wallet(privateKey, provider);
  contract = new ethers.Contract(ensureContractAddress(), contractABI, wallet);

  logBlockchainEvent("client:ready", { contractAddress: CONTRACT_ADDRESS });
  return { wallet, contract };
}

async function waitForTransaction(txHash, confirmations = 1, timeoutMs = 120000) {
  trackTransaction(txHash, { status: "pending", confirmations: 0 });

  const receipt = await provider.waitForTransaction(txHash, confirmations, timeoutMs);
  if (!receipt) {
    trackTransaction(txHash, { status: "timeout", confirmations: 0 });
    throw new Error(`Transaction ${txHash} failed to confirm within ${timeoutMs}ms timeout`);
  }

  trackTransaction(txHash, {
    status: receipt.status === 1 ? "confirmed" : "reverted",
    confirmations: 1,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed?.toString(),
  });

  return receipt;
}

async function verifyCertificateOnChain({ tokenId, expectedOwner = null, expectedMetadataURI = null }) {
  if (tokenId === null || tokenId === undefined || tokenId === "") {
    return { exists: false, verified: false, reason: "Missing tokenId" };
  }

  try {
    const readContract = getReadOnlyContract();
    const [owner, tokenURI] = await Promise.all([
      readContract.ownerOf(tokenId),
      readContract.tokenURI(tokenId),
    ]);

    const normalizedOwner = owner ? owner.toLowerCase() : null;
    const normalizedExpectedOwner = expectedOwner ? expectedOwner.toLowerCase() : null;
    const ownerMatches = normalizedExpectedOwner ? normalizedOwner === normalizedExpectedOwner : true;
    const tokenUriMatches = expectedMetadataURI ? tokenURI === expectedMetadataURI : true;

    return {
      exists: true,
      verified: ownerMatches && tokenUriMatches,
      owner,
      tokenURI,
      ownerMatches,
      tokenUriMatches,
      reason: ownerMatches && tokenUriMatches ? null : "On-chain owner or tokenURI mismatch",
    };
  } catch (error) {
    return { exists: false, verified: false, reason: error.message };
  }
}

async function mintCertificate(studentWallet, metadataURI) {
  let tx = null;
  let receipt = null;
  let tokenId = null;

  try {
    const { contract, wallet } = getBlockchainClient();

    if (!ethers.isAddress(studentWallet)) {
      throw new Error(`Invalid wallet address: ${studentWallet}`);
    }

    if (!metadataURI || !metadataURI.startsWith("ipfs://")) {
      throw new Error("Invalid metadata URI - must start with ipfs://");
    }

    const signerAddress = await wallet.getAddress();
    const network = await provider.getNetwork();
    const contractOwner = await getContractOwner().catch(() => null);

    if (contractOwner && contractOwner.toLowerCase() !== signerAddress.toLowerCase()) {
      throw new Error(
        `CRITICAL: Signer address mismatch!\n` +
        `  Configured signer: ${signerAddress}\n` +
        `  Contract owner: ${contractOwner}\n` +
        `  The backend wallet does NOT own this contract and cannot mint.\n` +
        `  FIX: Update WALLET_PRIVATE_KEY to match the address that deployed the contract.`
      );
    }

    logBlockchainEvent("mint:preflight-passed", {
      signerAddress, contractOwner, studentWallet,
      network: network.name,
    });

    const estimatedGas = await contract.mintCertificate.estimateGas(studentWallet, metadataURI);
    const gasLimit = (estimatedGas * 120n) / 100n;

    const nonce = await wallet.getNonce();

    logBlockchainEvent("mint:prepared", {
      signerAddress, contractOwner, studentWallet, metadataURI,
      contractAddress: CONTRACT_ADDRESS,
      chainId: Number(network.chainId),
      estimatedGas: estimatedGas.toString(),
      gasLimit: gasLimit.toString(),
      nonce,
    });

    tx = await contract.mintCertificate(studentWallet, metadataURI, { gasLimit, nonce });
    trackTransaction(tx.hash, { status: "submitted", nonce, studentWallet });

    logBlockchainEvent("mint:submitted", {
      txHash: tx.hash, studentWallet, metadataURI, nonce,
    });

    receipt = await waitForTransaction(tx.hash, 1, 120000);
    if (receipt.status !== 1) {
      throw new Error(
        `Transaction ${tx.hash} was reverted on-chain.\n` +
        `Check Polygon Scanner: https://amoy.polygonscan.com/tx/${tx.hash}`
      );
    }

    let transferEventFound = false;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics,
          data: log.data,
        });
        if (parsed && parsed.name === "Transfer") {
          tokenId = parsed.args[2]?.toString() || parsed.args.tokenId?.toString();
          transferEventFound = true;
          logBlockchainEvent("mint:transfer-event-found", { tokenId });
          break;
        }
      } catch { /* continue */ }
    }

    if (!tokenId || !transferEventFound) {
      try {
        const readContract = getReadOnlyContract();
        const totalSupply = await readContract.totalSupply();
        tokenId = totalSupply.toString();
        logBlockchainEvent("mint:token-id-fallback", { method: "totalSupply", tokenId });
      } catch (supplyErr) {
        logBlockchainEvent("mint:token-id-fallback-failed", { error: supplyErr.message });
      }
    }

    if (!tokenId) {
      throw new Error(
        `Token ID extraction failed from transaction ${tx.hash}.\n` +
        `Check Polygon Scanner: https://amoy.polygonscan.com/tx/${tx.hash}`
      );
    }

    const onChainVerification = await verifyCertificateOnChain({
      tokenId,
      expectedOwner: studentWallet,
      expectedMetadataURI: metadataURI,
    });

    if (!onChainVerification.verified) {
      throw new Error(
        `On-chain verification FAILED after mint.\n` +
        `Token ID: ${tokenId}\n` +
        `Expected owner: ${studentWallet}\n` +
        `Expected URI: ${metadataURI}\n` +
        `Reason: ${onChainVerification.reason || "unknown"}\n` +
        `Check Polygon Scanner: https://amoy.polygonscan.com/nft/${CONTRACT_ADDRESS}/${tokenId}`
      );
    }

    trackTransaction(tx.hash, {
      status: "verified",
      tokenId,
      blockNumber: receipt.blockNumber,
    });

    logBlockchainEvent("mint:confirmed", {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      tokenId,
      gasUsed: receipt.gasUsed?.toString?.() || null,
      ownerMatches: onChainVerification.ownerMatches,
      tokenUriMatches: onChainVerification.tokenUriMatches,
    });

    return {
      success: true,
      transactionHash: receipt.transactionHash,
      tokenId: tokenId.toString(),
      blockNumber: receipt.blockNumber,
      contractAddress: CONTRACT_ADDRESS,
      network: "Polygon Amoy Testnet",
      chainId: Number(network.chainId),
      gasUsed: receipt.gasUsed?.toString?.() || null,
      signerAddress,
      contractOwner,
      explorerUrl: `https://amoy.polygonscan.com/tx/${receipt.transactionHash}`,
      nftUrl: `https://amoy.polygonscan.com/nft/${CONTRACT_ADDRESS}/${tokenId}`,
    };
  } catch (error) {
    logBlockchainEvent("mint:failed", {
      message: error.message,
      txHash: tx?.hash || null,
      studentWallet,
    });

    if (tx?.hash) {
      trackTransaction(tx.hash, { status: "failed", error: error.message });
    }

    throw new Error(`NFT minting failed: ${error.message}`);
  }
}

async function getWalletInfo() {
  try {
    const { wallet } = getBlockchainClient();
    const address = await wallet.getAddress();
    const balance = await provider.getBalance(address);
    const network = await provider.getNetwork();
    const contractOwner = await getContractOwner().catch(() => null);

    return {
      address,
      balance: ethers.formatEther(balance),
      network: network.name,
      chainId: Number(network.chainId),
      contractAddress: CONTRACT_ADDRESS,
      contractOwner,
      ownerMatchesSigner: contractOwner
        ? contractOwner.toLowerCase() === address.toLowerCase()
        : null,
    };
  } catch (error) {
    console.error("[NFT Service] Wallet info error:", error.message);
    throw error;
  }
}

async function getBlockchainStatus() {
  try {
    const { wallet } = getBlockchainClient();
    const signerAddress = await wallet.getAddress();
    const contractOwner = await getContractOwner();
    const network = await provider.getNetwork();
    const totalSupply = await getReadOnlyContract().totalSupply();

    const signerMatches = signerAddress.toLowerCase() === contractOwner.toLowerCase();

    return {
      success: true,
      connected: true,
      rpcUrl: POLYGON_AMOY_RPC,
      chainId: Number(network.chainId),
      chainName: network.name,
      contractAddress: CONTRACT_ADDRESS,
      contractOwner,
      signerAddress,
      signerMatches,
      canMint: signerMatches,
      totalSupply: totalSupply.toString(),
      walletPrivateKeyConfigured: Boolean(process.env.WALLET_PRIVATE_KEY),
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      connected: false,
      error: error.message,
      walletPrivateKeyConfigured: Boolean(process.env.WALLET_PRIVATE_KEY),
      lastCheck: new Date().toISOString(),
    };
  }
}

async function validateBlockchainConfiguration() {
  const errors = [];
  const warnings = [];

  if (!process.env.CONTRACT_ADDRESS) errors.push("CONTRACT_ADDRESS not set");
  else if (!ethers.isAddress(process.env.CONTRACT_ADDRESS)) errors.push("CONTRACT_ADDRESS is not a valid EVM address");

  if (!process.env.WALLET_PRIVATE_KEY) errors.push("WALLET_PRIVATE_KEY not set");
  else {
    const normalizedKey = normalizePrivateKey(process.env.WALLET_PRIVATE_KEY);
    if (!normalizedKey) errors.push("WALLET_PRIVATE_KEY format invalid (must be 0x + 64 hex chars)");
  }

  if (!process.env.POLYGON_RPC_URL) warnings.push("POLYGON_RPC_URL not set, using default RPC");

  try {
    const { wallet } = getBlockchainClient();
    const signerAddress = await wallet.getAddress();
    const contractOwner = await getContractOwner();
    const network = await provider.getNetwork();

    if (network.chainId !== 80002n && network.chainId !== 80002) {
      errors.push(`Wrong network: Expected Polygon Amoy (80002), got chain ${network.chainId}`);
    }

    if (contractOwner.toLowerCase() !== signerAddress.toLowerCase()) {
      errors.push(`Signer mismatch: Wallet ${signerAddress} does not own contract (owner: ${contractOwner})`);
    }

    const balance = await provider.getBalance(signerAddress);
    if (balance === 0n) errors.push("Signer wallet has 0 balance. Need MATIC for gas fees.");
    else if (balance < ethers.parseEther("0.01")) warnings.push(`Low balance: ${ethers.formatEther(balance)} MATIC`);

    const totalSupply = await getReadOnlyContract().totalSupply();
    logBlockchainEvent("validation:contract-responsive", { totalSupply: totalSupply.toString() });
  } catch (err) {
    errors.push(`Connection test failed: ${err.message}`);
  }

  return { errors, warnings, valid: errors.length === 0 };
}

async function getDetailedBlockchainDiagnostics() {
  const result = {
    timestamp: new Date().toISOString(),
    environment: {
      hasContractAddress: !!process.env.CONTRACT_ADDRESS,
      hasPrivateKey: !!process.env.WALLET_PRIVATE_KEY,
      hasRpc: !!process.env.POLYGON_RPC_URL,
      rpcUrl: process.env.POLYGON_RPC_URL || "default",
    },
    validation: null,
    connection: null,
    contract: null,
    signer: null,
  };

  try {
    result.validation = await validateBlockchainConfiguration();

    if (result.validation.valid) {
      const { wallet } = getBlockchainClient();
      const network = await provider.getNetwork();
      const contractOwner = await getContractOwner();
      const signerAddress = await wallet.getAddress();
      const balance = await provider.getBalance(signerAddress);
      const totalSupply = await getReadOnlyContract().totalSupply();

      result.connection = {
        connected: true,
        network: `${network.name} (${network.chainId})`,
        rpcUrl: POLYGON_AMOY_RPC,
      };
      result.signer = {
        address: signerAddress,
        balance: ethers.formatEther(balance),
        ownsContract: contractOwner.toLowerCase() === signerAddress.toLowerCase(),
      };
      result.contract = {
        address: CONTRACT_ADDRESS,
        owner: contractOwner,
        totalSupply: totalSupply.toString(),
        explorerUrl: `https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}`,
      };
    } else {
      result.connection = { connected: false, errors: result.validation.errors };
    }
  } catch (err) {
    result.error = err.message;
    result.connection = { connected: false, error: err.message };
  }

  return result;
}

async function getTransactionHistory() {
  const history = [];
  for (const [txHash, state] of transactionHistory) {
    history.push({ txHash, ...state });
  }
  return history.sort((a, b) => b.lastUpdated - a.lastUpdated);
}

module.exports = {
  mintCertificate,
  getWalletInfo,
  verifyCertificateOnChain,
  getBlockchainStatus,
  getReadOnlyContract,
  getContractOwner,
  validateBlockchainConfiguration,
  getDetailedBlockchainDiagnostics,
  waitForTransaction,
  getTransactionState,
  getTransactionHistory,
};
