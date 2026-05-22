import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { verifyCertificate } from "../../shared/services/api";
import { convertIPFSToHTTPS, getImageUrl } from "../../shared/utils/ipfs";
import propTypes from "prop-types";

const POLYGON_EXPLORER = "https://amoy.polygonscan.com";
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";

function VerificationBadge({ verified }) {
  if (!verified) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-red-900/20 px-4 py-2 text-red-400">
        <span className="text-lg">✗</span>
        <span>Not Verified</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-green-900/20 px-4 py-2 text-green-400">
      <span className="text-lg">✓</span>
      <span>Verified on Blockchain</span>
    </div>
  );
}

VerificationBadge.propTypes = {
  verified: Boolean,
};

function NftImportGuideModal({ certificate, onClose }) {
  const contractAddr = CONTRACT_ADDRESS || certificate?.contractAddress || "";
  const tokenId = certificate?.tokenId || "";
  const txHash = certificate?.txHash || "";
  const ownerAddr = certificate?.walletAddress || certificate?.onChain?.owner || "";

  const steps = [
    {
      step: "1",
      title: "Open MetaMask",
      desc: "Launch your wallet extension or mobile app",
      detail: "Open the MetaMask browser extension in your desktop browser or launch the MetaMask mobile app on your phone.",
    },
    {
      step: "2",
      title: "Switch Network",
      desc: "Polygon Amoy Testnet",
      detail: "Change your network to Polygon Amoy Testnet (Chain ID: 80002). If you don't see it, add it manually via Settings → Networks → Add Network.",
    },
    {
      step: "3",
      title: "Go to NFTs Tab",
      desc: "Navigate to your NFT collection",
      detail: "In MetaMask, click the NFTs tab at the bottom of the wallet interface to view your imported NFTs.",
    },
    {
      step: "4",
      title: "Import NFT",
      desc: "Click the Import NFT button",
      detail: 'Tap the "Import NFT" or "Add NFT" button. MetaMask will ask you to enter the contract address and token ID.',
    },
    {
      step: "5",
      title: "Enter Contract Address",
      desc: "Paste the contract address",
      detail: "Copy the contract address below and paste it into the Address field in MetaMask.",
      copyText: contractAddr,
      copyLabel: "Copy Contract Address",
    },
    {
      step: "6",
      title: "Enter Token ID",
      desc: "Paste the token ID",
      detail: "Copy the token ID below and paste it into the ID field in MetaMask.",
      copyText: tokenId,
      copyLabel: "Copy Token ID",
    },
    {
      step: "7",
      title: "Done!",
      desc: "Your NFT certificate is now in MetaMask",
      detail: "Click Import in MetaMask. Your certificate should now appear in the NFTs tab of your wallet.",
    },
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const item = steps[currentStep];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative w-full max-w-xl rounded-2xl border border-white/[0.08] bg-gradient-to-br from-gray-900 via-gray-900 to-purple-950 p-6 shadow-2xl shadow-purple-900/30 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 border border-purple-500/30 px-4 py-1.5 mb-3">
            <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span className="text-sm font-semibold text-purple-300">NFT Import Guide</span>
          </div>
          <h2 className="text-xl font-bold text-white">Import NFT to MetaMask</h2>
        </div>

        <div className="relative mb-6 px-2">
          <div className="absolute top-4 left-6 right-6 h-px bg-gradient-to-r from-purple-500/20 via-cyan-500/30 to-purple-500/20" />
          <div className="flex justify-between relative">
            {steps.map((s, i) => {
              const isDone = i < currentStep;
              const isActive = i === currentStep;
              return (
                <button
                  key={s.step}
                  onClick={() => setCurrentStep(i)}
                  className="flex flex-col items-center gap-1 group"
                >
                  <div
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                      isActive
                        ? "bg-gradient-to-br from-purple-500 to-cyan-500 text-white shadow-[0_0_14px_rgba(0,245,255,0.4)] scale-110"
                        : isDone
                        ? "bg-green-500/20 border border-green-500/50 text-green-300"
                        : "bg-white/5 border border-white/10 text-gray-500"
                    }`}
                  >
                    {isDone ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s.step
                    )}
                  </div>
                  <span className={`text-[8px] font-semibold uppercase tracking-wider ${
                    isActive ? "text-cyan-300" : isDone ? "text-green-400/60" : "text-gray-600"
                  }`}>
                    {s.title.slice(0, 8)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-5 mb-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-xs font-bold text-white">
                {item.step}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{item.title}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">{item.detail}</p>

            {item.copyText && (
              <div className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/[0.06] p-2.5">
                <code className="flex-1 text-xs font-mono text-cyan-300 truncate">{item.copyText}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(item.copyText)}
                  className="flex-shrink-0 rounded-md bg-cyan-500/20 px-2.5 py-1 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-500/30 transition"
                >
                  Copy
                </button>
              </div>
            )}

            <div className="mt-3 flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">Step {item.step} of {steps.length}</span>
              <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-3 mb-5">
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep((p) => p - 1)}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition"
            >
              Back
            </button>
          )}
          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep((p) => p + 1)}
              className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:from-purple-700 hover:to-cyan-700 transition"
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:from-green-700 hover:to-emerald-700 transition"
            >
              Complete
            </button>
          )}
        </div>

        {contractAddr && (
          <div className="rounded-xl bg-black/30 border border-white/10 p-3 mb-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Contract</p>
              <button onClick={() => navigator.clipboard.writeText(contractAddr)} className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold">Copy</button>
            </div>
            <code className="text-xs font-mono text-purple-400 break-all">{contractAddr}</code>
          </div>
        )}
        {tokenId && (
          <div className="rounded-xl bg-black/30 border border-white/10 p-3 mb-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Token ID</p>
              <button onClick={() => navigator.clipboard.writeText(tokenId)} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">Copy</button>
            </div>
            <code className="text-xs font-mono text-indigo-400">{tokenId}</code>
          </div>
        )}

        <div className="flex gap-2">
          {txHash && (
            <a
              href={`${POLYGON_EXPLORER}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-600/30 transition"
            >
              View Tx
            </a>
          )}
          {ownerAddr && (
            <a
              href={`${POLYGON_EXPLORER}/address/${ownerAddr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30 transition"
            >
              Wallet
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
NftImportGuideModal.propTypes = {
  certificate: propTypes.object,
  onClose: propTypes.func.isRequired,
};

export default function VerifyCertificate() {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showImportGuide, setShowImportGuide] = useState(false);

  const fetchCertificate = useCallback(async () => {
    if (!certificateId) {
      setError("Certificate ID not provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await verifyCertificate(certificateId);
      setCertificate(data.certificate);
      setError(null);
    } catch (err) {
      console.error("Verification error:", err);
      setError(err.response?.data?.error || "Certificate not found or invalid");
      setCertificate(null);
    } finally {
      setLoading(false);
    }
  }, [certificateId]);

  useEffect(() => {
    fetchCertificate();
  }, [fetchCertificate]);

  const shortenHash = (hash) => (hash ? `${hash.slice(0, 12)}...${hash.slice(-10)}` : "N/A");
  const onChain = certificate?.onChain || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-black text-white">Certificate Verification</h1>
            <p className="mt-2 text-gray-400">Verify NFT certificate authenticity on blockchain</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/[0.06]"
          >
            ← Back
          </button>
        </motion.div>

        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="h-96 animate-pulse rounded-xl bg-gray-800/20" />
            <div className="h-40 animate-pulse rounded-xl bg-gray-800/20" />
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center rounded-xl border border-red-900/30 bg-red-900/10 py-16 text-center"
          >
            <div className="mb-4 text-5xl">❌</div>
            <h2 className="text-2xl font-bold text-red-400">Certificate Not Found</h2>
            <p className="mt-2 text-red-300">{error}</p>
            <p className="mt-6 text-sm text-gray-400">Make sure you have the correct certificate ID.</p>
          </motion.div>
        ) : certificate ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex justify-center">
              <VerificationBadge verified={certificate.verified} />
            </div>

            {(certificate.imageURI || certificate.imageHTTPS) && (
              <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-gray-900 to-gray-800/50 p-6 text-center">
                <h3 className="mb-4 text-lg font-bold text-white">Certificate Image</h3>
                <img
                  src={getImageUrl(certificate)}
                  alt={`Certificate for ${certificate.studentName}`}
                  className="mx-auto max-h-96 rounded-lg border border-white/[0.1]"
                  onError={(e) => {
                    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23333' width='400' height='300'/%3E%3Ctext fill='%23999' text-anchor='middle' x='200' y='150'%3EImage not available%3C/text%3E%3C/svg%3E";
                  }}
                />
              </div>
            )}

            <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-gray-900 to-gray-800/50 p-8">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Student Name</h3>
                  <p className="text-2xl font-bold text-white">{certificate.studentName}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Community</h3>
                  <p className="text-2xl font-bold text-purple-400">{certificate.communityName}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">College</h3>
                  <p className="text-lg text-gray-300">{certificate.collegeName}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Certificate ID</h3>
                  <p className="font-mono text-lg text-indigo-400">{certificate.certificateId}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Issued Date</h3>
                  <p className="text-lg text-gray-300">
                    {new Date(certificate.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Token ID</h3>
                  <p className="font-mono text-lg text-teal-400">{certificate.tokenId || "Pending"}</p>
                </div>
              </div>
            </div>

            {certificate.txHash && (
              <div className="rounded-xl border border-white/[0.08] bg-gray-900/40 p-6">
                <h3 className="mb-4 text-lg font-bold text-white">Blockchain Verification</h3>
                <div className="space-y-4">
                  <div className="rounded-lg bg-gray-800/40 p-3">
                    <p className="text-xs font-semibold uppercase text-gray-500">On-Chain Status</p>
                    <p className={`mt-1 text-sm ${certificate.verified ? "text-emerald-300" : "text-amber-300"}`}>
                      {certificate.verified ? "Confirmed on Polygon Amoy" : (onChain?.reason || "Certificate record exists, but the NFT is not confirmed on-chain")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Transaction Hash</p>
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-800/50 p-3">
                      <code className="break-all font-mono text-sm text-gray-300">{shortenHash(certificate.txHash)}</code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(certificate.txHash)}
                        className="ml-2 rounded px-2 py-1 text-xs text-gray-400 transition hover:bg-white/[0.06]"
                        title="Copy to clipboard"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`${POLYGON_EXPLORER}/tx/${certificate.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600/20 px-4 py-2 text-sm font-medium text-indigo-300 transition hover:bg-indigo-600/30"
                    >
                      View Transaction on PolygonScan
                      <span>↗</span>
                    </a>
                    {certificate.walletAddress && (
                      <a
                        href={`${POLYGON_EXPLORER}/address/${certificate.walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-600/30"
                      >
                        View Wallet
                        <span>↗</span>
                      </a>
                    )}
                  </div>
                  {onChain?.owner && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">Current Owner</p>
                      <p className="mt-1 break-all font-mono text-sm text-gray-300">{onChain.owner}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {certificate.metadataURI && (
              <div className="rounded-xl border border-white/[0.08] bg-gray-900/40 p-6">
                <h3 className="mb-4 text-lg font-bold text-white">IPFS Metadata & Gateway URLs</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Metadata URI (IPFS)</p>
                    <p className="mt-1 break-all font-mono text-gray-400">{certificate.metadataURI}</p>
                  </div>
                  {certificate.metadataHTTPS && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">Metadata URL (HTTPS)</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="flex-1 break-all font-mono text-green-400">{certificate.metadataHTTPS}</p>
                        <a href={certificate.metadataHTTPS} target="_blank" rel="noopener noreferrer"
                          className="whitespace-nowrap rounded px-2 py-1 text-xs text-green-300 transition hover:bg-green-500/20">
                          View ↗
                        </a>
                      </div>
                    </div>
                  )}
                  {certificate.imageURI && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">Image URI (IPFS)</p>
                      <p className="mt-1 break-all font-mono text-gray-400">{certificate.imageURI}</p>
                    </div>
                  )}
                  {certificate.imageHTTPS && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">Image URL (HTTPS - for MetaMask)</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="flex-1 break-all font-mono text-green-400">{certificate.imageHTTPS}</p>
                        <a href={certificate.imageHTTPS} target="_blank" rel="noopener noreferrer"
                          className="whitespace-nowrap rounded px-2 py-1 text-xs text-green-300 transition hover:bg-green-500/20">
                          View ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-white/[0.08] bg-gray-900/40 p-6 text-center">
              <h3 className="mb-4 text-lg font-bold text-white">Certificate QR Code</h3>
              <p className="mb-4 text-sm text-gray-400">Scan to verify this certificate</p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(certificate.verificationUrl)}`}
                alt="Certificate QR Code"
                className="mx-auto rounded-lg border border-white/[0.1] p-4"
              />
            </div>

            {/* Import NFT Guide Section */}
            <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-900/20 to-indigo-900/20 p-6">
              <h3 className="mb-4 text-lg font-bold text-white">How to Import Your NFT Certificate</h3>
              <div className="space-y-4">
                {[
                  { title: "Open MetaMask", desc: "Open MetaMask extension or mobile app" },
                  { title: "Switch to Polygon Amoy", desc: "Ensure network is set to Polygon Amoy Testnet (Chain ID: 80002)" },
                  { title: "Go to NFTs Tab", desc: "Navigate to the NFTs section in your wallet" },
                  { title: "Click Import NFT", desc: 'Tap "Import NFT" or "Add NFT" button' },
                  { title: "Enter Contract Address & Token ID", desc: "Use the details below or click Import Guide for step-by-step help" },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-white">{step.title}</p>
                      <p className="text-sm text-gray-400">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setShowImportGuide(true)}
                  className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 font-bold text-white transition hover:from-purple-700 hover:to-indigo-700 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Open Import Guide
                </button>
                {certificate.tokenId && CONTRACT_ADDRESS && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(CONTRACT_ADDRESS);
                    }}
                    className="rounded-lg bg-purple-600/20 border border-purple-500/30 px-6 py-3 font-bold text-purple-300 transition hover:bg-purple-600/30"
                  >
                    Copy Contract Address
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>

      <AnimatePresence>
        {showImportGuide && (
          <NftImportGuideModal certificate={certificate} onClose={() => setShowImportGuide(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
