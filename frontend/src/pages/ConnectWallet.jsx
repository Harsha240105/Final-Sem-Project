import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAccount, useConnect, useSwitchChain } from "wagmi";
import { useWallet } from "../hooks/useWallet";

const WALLET_ICONS = {
  metaMask: "🦊",
  walletConnect: "🔗",
  coinbaseWallet: "🔵",
};

function ParticleField() {
  const particles = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: 1 + Math.random() * 2.5, duration: 25 + Math.random() * 35,
      delay: Math.random() * 20, opacity: 0.1 + Math.random() * 0.3,
    }));
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div key={p.id}
          className="absolute rounded-full bg-cyan-400"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, opacity: p.opacity, animation: `float-particle ${p.duration}s infinite linear`, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
}

function ConnectWallet() {
  const navigate = useNavigate();
  const { connectWallet, disconnectWallet, isMetaMaskInstalled, isConnecting, isConnected, networkName } = useWallet();
  const { address, chainId } = useAccount();
  const { connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const [connectingId, setConnectingId] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleConnect = async (connector) => {
    setConnectingId(connector.id);
    try {
      await connectWallet(connector);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async () => {
    await disconnectWallet();
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchChainAsync({ chainId: 80002 });
    } catch { /* user rejected */ }
  };

  const handleContinue = () => {
    navigate("/login");
  };

  if (!mounted) return null;

  const isOnAmoy = chainId === 80002;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <ParticleField />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">
              {isConnected ? "🔐" : "🦊"}
            </div>
            <h1 className="text-2xl font-bold text-white">
              {isConnected ? "Wallet Connected" : "Connect Your Wallet"}
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              {isConnected
                ? "Your wallet is ready. Continue to login or switch networks."
                : "Connect a wallet to access the Web3Connect platform."}
            </p>
          </div>

          {/* Connection Status */}
          {isConnected && address && (
            <div className="bg-gray-800/60 rounded-xl p-4 mb-6 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-sm font-medium">Connected</span>
              </div>
              <div className="bg-gray-900/60 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-400">Address: </span>
                <span className="text-cyan-300 font-mono">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-400">Network: {networkName}</span>
                {!isOnAmoy && (
                  <button
                    onClick={handleSwitchNetwork}
                    className="text-xs bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg hover:bg-yellow-500/30 transition-colors"
                  >
                    Switch to Amoy
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Wallet List */}
          {!isConnected && (
            <div className="space-y-3 mb-6">
              {connectors
                .filter((c) => c.ready || c.id === "metaMask")
                .map((connector) => {
                  const isMetamaskConnector = connector.id === "metaMask";
                  const notInstalled = isMetamaskConnector && !isMetaMaskInstalled;
                  return (
                    <button
                      key={connector.id}
                      onClick={() => handleConnect(connector)}
                      disabled={isConnecting || connectingId === connector.id}
                      className="w-full flex items-center gap-4 bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 hover:border-cyan-500/50 rounded-xl px-5 py-4 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <span className="text-2xl">
                        {WALLET_ICONS[connector.id] || "💼"}
                      </span>
                      <div className="flex-1 text-left">
                        <div className="text-white font-medium group-hover:text-cyan-300 transition-colors">
                          {connector.name}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {notInstalled ? "Not installed" : "Recommended"}
                        </div>
                      </div>
                      {connectingId === connector.id ? (
                        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {isConnected ? (
              <>
                <button
                  onClick={handleContinue}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/25"
                >
                  Continue to Login →
                </button>
                <button
                  onClick={handleDisconnect}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 px-6 rounded-xl border border-gray-700/50 transition-all duration-200"
                >
                  Disconnect Wallet
                </button>
              </>
            ) : (
              <p className="text-center text-gray-500 text-xs">
                By connecting, you agree to the platform terms.
                <br />
                No gas fees are required for wallet connection.
              </p>
            )}
          </div>

          {/* Skip link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/login")}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Skip — I'll connect later →
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default ConnectWallet;