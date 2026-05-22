import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../shared/hooks/useAuth";
import { useToast } from "../../shared/hooks/useToast";
import { getUserCertificates, syncCertificateStatus } from "../../shared/services/api";
import { convertIPFSToHTTPS, getImageUrl } from "../../shared/utils/ipfs";
import { useMintProgress } from "./hooks/useMintProgress";
import MintProgress from "./components/MintProgress";
import propTypes from "prop-types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, "") || "http://localhost:5000";
const POLYGON_EXPLORER = "https://amoy.polygonscan.com";
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";

const STEP_ICONS = [
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064",
  "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
];

function NftClaimGuide({ cert, onClose }) {
  const imageURL = getImageUrl(cert);
  const walletAddress = cert.walletAddress || "";
  const contractAddr = cert.contractAddress || CONTRACT_ADDRESS;
  const tokenId = cert.tokenId || "";
  const txHash = cert.txHash || "";
  const [currentStep, setCurrentStep] = useState(0);
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });
  const cardRef = useState(null);

  const steps = [
    { step: "01", title: "Open PolygonScan", desc: "Navigate to Polygon Amoy Testnet Explorer", detail: "Go to amoy.polygonscan.com to start tracking your NFT transaction.", link: POLYGON_EXPLORER, linkLabel: "Open PolygonScan" },
    { step: "02", title: "Find Transaction", desc: "Search your wallet or transaction hash", detail: "Paste your wallet address or transaction hash into the search bar.", copyText: walletAddress || txHash, copyLabel: walletAddress ? "Copy Wallet" : "Copy Tx Hash" },
    { step: "03", title: "Get Contract", desc: "Copy the contract from the transaction", detail: 'In transaction details, find "Interacted With (To)" and copy.', copyText: contractAddr, copyLabel: "Copy Contract" },
    { step: "04", title: "Copy Token ID", desc: "Find the ERC-721 Token ID", detail: "Locate the Token ID in the Transfer event or transaction logs.", copyText: tokenId, copyLabel: "Copy Token ID" },
    { step: "05", title: "Open MetaMask", desc: "Launch your MetaMask extension", detail: "Open MetaMask browser extension or mobile app." },
    { step: "06", title: "Switch Network", desc: "Polygon Amoy Testnet", detail: "Switch to Polygon Amoy Testnet (Chain ID: 80002)." },
    { step: "07", title: "NFTs Tab", desc: "Navigate to your NFT collection", detail: "Click the NFTs tab in your MetaMask wallet." },
    { step: "08", title: "Import NFT", desc: "Add your certificate", detail: "Click 'Import NFT' and paste contract address + token ID.", copyText: `${contractAddr}|${tokenId}`, copyLabel: "Copy Both" },
    { step: "09", title: "Activated!", desc: "Your NFT certificate is live in MetaMask", detail: "Your certificate now appears in your MetaMask NFTs tab." },
  ];

  const item = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setCardTilt({ x: y * -20, y: x * 20 });
  };

  const handleMouseLeave = () => setCardTilt({ x: 0, y: 0 });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 overflow-hidden"
      onClick={onClose}
    >
      {/* Ambient glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-cyan-600/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[150px]" />
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/20"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{
              y: [0, -30, 0],
              opacity: [0, 0.8, 0],
              scale: [0, 1, 0],
            }}
            transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 5 }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/[0.06] bg-gradient-to-br from-gray-950/95 via-slate-900/95 to-indigo-950/95 p-6 md:p-8 shadow-2xl shadow-purple-900/20 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="absolute top-4 right-4 z-20 rounded-full p-2 text-gray-400 hover:bg-white/5 hover:text-white border border-white/[0.04]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>

        {/* Header badge */}
        <div className="flex items-center gap-3 mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            <span className="text-xs font-semibold text-purple-300 tracking-wider uppercase">NFT Activation</span>
          </motion.div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="flex-1 h-px bg-gradient-to-r from-purple-500/30 via-cyan-500/20 to-transparent"
          />
        </div>

        <div className="grid md:grid-cols-5 gap-6 md:gap-8">
          {/* LEFT: Holographic NFT Card */}
          <div className="md:col-span-2 space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="relative"
            >
              {/* Glow behind card */}
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -inset-4 rounded-2xl bg-gradient-to-br from-purple-600/20 via-cyan-500/10 to-indigo-600/20 blur-2xl"
              />

              {/* NFT Card */}
              <motion.div
                ref={cardRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                animate={{ rotateX: cardTilt.x, rotateY: cardTilt.y }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                style={{ transformStyle: "preserve-3d" }}
                className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-gray-900 to-gray-800 shadow-2xl cursor-pointer group"
              >
                {/* Shine overlay */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10"
                  style={{
                    background: `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(168,85,247,0.05) 100%)`,
                    transform: `translateX(${cardTilt.y * 2}px) translateY(${cardTilt.x * 2}px)`,
                  }}
                />

                {/* Energy ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-1 rounded-2xl opacity-30"
                  style={{
                    background: `conic-gradient(from 0deg, transparent, rgba(168,85,247,0.3), rgba(6,182,212,0.3), transparent)`,
                    WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                    padding: "1px",
                  }}
                />

                {/* Image */}
                {imageURL ? (
                  <motion.div
                    initial={{ scale: 1.1, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="relative"
                  >
                    <img
                      src={imageURL}
                      alt="Certificate"
                      className="w-full aspect-[4/3] object-cover"
                      onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23333' width='400' height='300'/%3E%3Ctext fill='%23999' text-anchor='middle' x='200' y='140' font-size='14'%3EImage not%3C/text%3E%3Ctext fill='%23999' text-anchor='middle' x='200' y='160' font-size='14'%3Eavailable%3C/text%3E%3C/svg%3E"; }}
                    />
                    {/* Reflection sweep */}
                    <motion.div
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1 }}
                      className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12"
                    />
                  </motion.div>
                ) : (
                  <div className="w-full aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-cyan-900/30">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="text-6xl"
                    >
                      🎓
                    </motion.div>
                  </div>
                )}

                {/* Card footer */}
                <div className="p-4 border-t border-white/[0.04]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Token #{tokenId || "—"}</p>
                      <p className="text-sm font-bold text-white truncate">{cert.communityName || "Certificate"}</p>
                    </div>
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] font-semibold text-emerald-300">Verified</span>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Quick copy panel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-xl bg-black/30 border border-white/[0.04] p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Contract</span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigator.clipboard.writeText(contractAddr)}
                  className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </motion.button>
              </div>
              <code className="block text-xs font-mono text-purple-400/80 truncate">{contractAddr}</code>
            </motion.div>
          </div>

          {/* RIGHT: Mission Control */}
          <div className="md:col-span-3 space-y-5">
            {/* Energy progress timeline */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative"
            >
              <div className="absolute top-4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
              <div className="flex justify-between relative px-1">
                {steps.map((s, i) => {
                  const isDone = i < currentStep;
                  const isActive = i === currentStep;
                  return (
                    <motion.button
                      key={s.step}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentStep(i)}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <motion.div
                        animate={isActive ? {
                          boxShadow: [
                            "0 0 0 0 rgba(168,85,247,0.4)",
                            "0 0 0 6px rgba(168,85,247,0)",
                          ],
                        } : {}}
                        transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
                        className={`relative flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full text-[10px] md:text-xs font-bold transition-all duration-500 ${
                          isActive
                            ? "bg-gradient-to-br from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/30 scale-110"
                            : isDone
                            ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                            : "bg-white/[0.03] border border-white/[0.06] text-gray-600"
                        }`}
                      >
                        {isDone ? (
                          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="relative">
                            {s.step}
                            {isActive && (
                              <motion.span
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="absolute inset-0 rounded-full bg-purple-400/20"
                              />
                            )}
                          </span>
                        )}
                      </motion.div>
                      <span className={`text-[6px] md:text-[7px] font-semibold uppercase tracking-widest transition-colors duration-300 ${
                        isActive ? "text-cyan-300" : isDone ? "text-emerald-400/60" : "text-gray-600"
                      }`}>
                        {s.title.slice(0, 6)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Mission step card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.97 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-white/[0.01] p-5 md:p-6 overflow-hidden"
              >
                {/* Step number glow */}
                <div className="absolute -top-6 -right-6 text-8xl font-black text-white/[0.02] select-none pointer-events-none">
                  {item.step}
                </div>

                <div className="flex items-start gap-4 mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                    className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 text-sm font-bold text-white shadow-lg shadow-purple-500/20"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={STEP_ICONS[currentStep] || STEP_ICONS[0]} />
                    </svg>
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <motion.h3
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-lg font-bold text-white"
                    >
                      {item.title}
                    </motion.h3>
                    <motion.p
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-sm text-gray-400"
                    >
                      {item.desc}
                    </motion.p>
                  </div>
                </div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-xs text-gray-500 leading-relaxed mb-4 ml-14"
                >
                  {item.detail}
                </motion.p>

                {/* Action area */}
                <div className="ml-14 space-y-3">
                  {item.link && (
                    <motion.a
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-purple-500/10 border border-purple-500/20 px-4 py-2.5 text-sm font-medium text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {item.linkLabel}
                      <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </motion.a>
                  )}

                  {item.copyText && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="flex items-center gap-2 rounded-xl bg-black/40 border border-white/[0.06] p-3 group"
                    >
                      <code className="flex-1 text-xs font-mono text-cyan-300/80 truncate">
                        {item.copyText}
                      </code>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigator.clipboard.writeText(item.copyText)}
                        className="flex-shrink-0 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-500/25 transition-all border border-cyan-500/10"
                      >
                        Copy
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation + progress */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 font-mono">
                  STEP {item.step} OF {steps.length}
                </span>
                <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 via-cyan-500 to-emerald-500"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                {currentStep > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentStep((p) => p - 1)}
                    className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-medium text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all"
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </span>
                  </motion.button>
                )}
                {currentStep < steps.length - 1 ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentStep((p) => p + 1)}
                    className="group relative flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 text-sm font-bold text-white overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                    <span className="relative flex items-center justify-center gap-1.5">
                      Next Step
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </motion.button>
                ) : (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="group relative flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-bold text-white overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                    <span className="relative flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Complete Activation
                    </span>
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 pt-4 border-t border-white/[0.04] flex items-center justify-between"
        >
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
              Polygon Amoy
            </span>
            <span>·</span>
            <span>Token #{tokenId || "—"}</span>
            <span>·</span>
            <span>{cert.communityName || "Certificate"}</span>
          </div>
          <div className="flex items-center gap-2">
            {txHash && (
              <motion.a
                whileHover={{ scale: 1.05 }}
                href={`${POLYGON_EXPLORER}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Explorer
              </motion.a>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
NftClaimGuide.propTypes = {
  cert: propTypes.object.isRequired,
  onClose: propTypes.func.isRequired,
};

function CertificateCard({ cert, onViewClick }) {
  const issuedDate = new Date(cert.issuedAt || cert.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const imageURL = getImageUrl(cert);

  const getStatusBadge = () => {
    const status = cert.status || "issued";

    const statusConfig = {
      issued: { label: "Pending Claim", color: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400" },
      claimed: { label: "Completed", color: "bg-green-500/20 border-green-500/30 text-green-400" },
      completed: { label: "Completed", color: "bg-green-500/20 border-green-500/30 text-green-400" },
      failed: { label: "Failed", color: "bg-red-500/20 border-red-500/30 text-red-400" },
      tx_submitted: { label: "Processing", color: "bg-blue-500/20 border-blue-500/30 text-blue-400" },
    };

    const config = statusConfig[status] || statusConfig.issued;
    return (
      <div className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${config.color}`}>
        {config.label}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-gray-900 to-gray-800/50 p-5 transition hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-900/20"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-white truncate">{cert.communityName}</h3>
            <p className="text-xs text-gray-400 truncate">ID: {cert.certificateId}</p>
          </div>
          {getStatusBadge()}
        </div>

        {imageURL && (
          <div className="overflow-hidden rounded-lg border border-purple-500/20 bg-gray-800/20">
            <img
              src={imageURL}
              alt={`${cert.communityName} certificate`}
              className="h-32 w-full object-cover"
              onError={(e) => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23333' width='400' height='300'/%3E%3Ctext fill='%23999' text-anchor='middle' x='200' y='140' font-size='14'%3EImage not%3C/text%3E%3Ctext fill='%23999' text-anchor='middle' x='200' y='160' font-size='14'%3Eavailable%3C/text%3E%3C/svg%3E"; }}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gray-500">Certificate ID</p>
            <p className="font-mono text-purple-400 text-[11px]">{cert.certificateId}</p>
          </div>
          <div>
            <p className="text-gray-500">Issued</p>
            <p className="text-white">{issuedDate}</p>
          </div>
          <div>
            <p className="text-gray-500">Token ID</p>
            <p className="font-mono text-indigo-400 text-[11px]">{cert.tokenId || "Pending..."}</p>
          </div>
          <div>
            <p className="text-gray-500">College</p>
            <p className="text-white truncate">{cert.collegeName || "N/A"}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => onViewClick(cert)}
            className="flex-1 rounded-lg bg-purple-600/20 px-3 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-600/30 active:scale-95"
          >
            View Certificate
          </button>
          {cert.txHash && (
            <a
              href={`${POLYGON_EXPLORER}/tx/${cert.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-indigo-600/20 px-3 py-2 text-center text-sm font-medium text-indigo-300 transition hover:bg-indigo-600/30 active:scale-95"
            >
              Explorer
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
CertificateCard.propTypes = {
  cert: propTypes.object.isRequired,
  onViewClick: propTypes.func.isRequired,
};

export default function MyCertificates() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("newest");
  const [filterBy, setFilterBy] = useState("all");
  const [selectedCert, setSelectedCert] = useState(null);
  const { activeJobs, lastCompleted, lastFailed, clearCompleted, clearFailed, isMinting } = useMintProgress();

  const fetchCertificates = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setCertificates([]);
        setLoading(false);
        return;
      }

      console.log("[MyCertificates] Fetching certificates...");
      const data = await getUserCertificates(token);
      const certs = Array.isArray(data) ? data : [];

      console.log("FRONTEND CERTIFICATES:", certs);
      console.log("TOTAL_CERTIFICATES:", certs.length);

      setCertificates(certs);
    } catch (err) {
      console.error("[MyCertificates] Failed to fetch certificates:", err);
      setCertificates([]);
      addToast("Failed to load certificates", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const syncAndFetch = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      console.log("[MyCertificates] Syncing certificate status with blockchain...");
      const synced = await syncCertificateStatus(token);
      const certs = Array.isArray(synced) ? synced : [];

      console.log("FRONTEND CERTIFICATES (after sync):", certs);
      console.log("TOTAL_CERTIFICATES:", certs.length);

      setCertificates(certs);
      setLoading(false);
    } catch (err) {
      console.error("[MyCertificates] Sync failed, falling back to regular fetch:", err);
      await fetchCertificates();
    }
  }, [fetchCertificates, addToast]);

  const getFilteredAndSortedCertificates = () => {
    let filtered = [...certificates];

    if (filterBy === "pending") {
      filtered = filtered.filter((c) => c.status === "issued" || !c.status);
    } else if (filterBy === "claimed") {
      filtered = filtered.filter((c) => c.status === "claimed" || c.status === "completed" || c.claimed === true || c.walletClaimed === true);
    } else if (filterBy === "failed") {
      filtered = filtered.filter((c) => c.status === "failed");
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.issuedAt || a.createdAt || 0);
      const dateB = new Date(b.issuedAt || b.createdAt || 0);
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  };

  useEffect(() => {
    syncAndFetch();
  }, [syncAndFetch]);

  // Refetch certificates when a mint completes
  useEffect(() => {
    if (lastCompleted) {
      syncAndFetch();
    }
  }, [lastCompleted, syncAndFetch]);

  useEffect(() => {
    const onCertificatesUpdated = () => {
      syncAndFetch();
    };
    window.addEventListener("certificates-updated", onCertificatesUpdated);
    return () => window.removeEventListener("certificates-updated", onCertificatesUpdated);
  }, [syncAndFetch]);

  const handleViewCertificate = (cert) => {
    setSelectedCert(cert);
  };

  if (!user) return null;
  if (["admin", "teacher"].includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  const filtered = getFilteredAndSortedCertificates();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-black text-white">My NFT Certificates</h1>
          <p className="mt-2 text-gray-400">All certificates earned from completed community tasks</p>
        </motion.div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-800/20" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Filter:</label>
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value)}
                  className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="claimed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Sort:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
              <div className="ml-auto text-sm text-gray-400">
                Showing {certificates.length} certificates
              </div>
            </div>

            {certificates.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-gray-900/40 py-16 text-center"
              >
                <div className="mb-4 text-5xl">🎓</div>
                <h2 className="text-xl font-bold text-white">No certificates yet</h2>
                <p className="mt-2 text-gray-400">Complete community tasks to earn NFT certificates</p>
              </motion.div>
            ) : filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-gray-900/40 py-16 text-center"
              >
                <div className="mb-4 text-5xl">🔍</div>
                <h2 className="text-xl font-bold text-white">No matching certificates</h2>
                <p className="mt-2 text-gray-400">Try changing the filter to see more results</p>
              </motion.div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {filtered.map((cert) => (
                    <CertificateCard
                      key={cert._id || cert.certificateId}
                      cert={cert}
                      onViewClick={handleViewCertificate}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>

      <MintProgress
        activeJobs={activeJobs}
        lastCompleted={lastCompleted}
        lastFailed={lastFailed}
        onDismissComplete={clearCompleted}
        onDismissFailed={clearFailed}
      />

      <AnimatePresence>
        {selectedCert && (
          <NftClaimGuide cert={selectedCert} onClose={() => setSelectedCert(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
