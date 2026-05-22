import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useSocket } from "../../../shared/services/SocketContext";

function shortenAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function WalletNFTStatus({ account, networkName, myNFTs, lastSynced, onSync, syncing }) {
  const { socket, connected } = useSocket();
  const [detectedNFTs, setDetectedNFTs] = useState([]);
  const [detecting, setDetecting] = useState(false);

  const detectNFTs = useCallback(async () => {
    if (!account) return;
    setDetecting(true);
    try {
      if (typeof window.ethereum !== "undefined" && account) {
        const res = await fetch(
          `https://deep-index.moralis.io/api/v2/${account}/nft?chain=polygon%20amoy&format=decimal`,
          { headers: { "X-API-Key": import.meta.env.VITE_MORALIS_API_KEY || "" } }
        );
        if (res.ok) {
          const data = await res.json();
          setDetectedNFTs(data.result?.slice(0, 5) || []);
        }
      }
    } catch {
      /* silent */
    } finally {
      setDetecting(false);
    }
  }, [account]);

  useEffect(() => {
    if (account) detectNFTs();
    else setDetectedNFTs([]);
  }, [account, detectNFTs]);

  useEffect(() => {
    if (!socket) return;
    const handleMint = () => { detectNFTs(); };
    socket.on("nft_minted", handleMint);
    return () => socket.off("nft_minted", handleMint);
  }, [socket, detectNFTs]);

  return (
    <div className="glass-card-premium p-5 holographic">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
            <svg className="h-4 w-4 text-cyan-300" viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h.75a2.25 2.25 0 012.25 2.25" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white">Wallet & NFTs</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-green-400" : "bg-red-400"} animate-pulse`} />
          <span className="text-[9px] text-gray-500">{connected ? "Live" : "Offline"}</span>
        </div>
      </div>

      {/* Wallet status */}
      <div className="rounded-lg bg-white/[0.03] p-3 mb-3 border border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 font-medium mb-0.5">Network</p>
            <p className="text-xs font-semibold text-white">{networkName || "Not connected"}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 font-medium mb-0.5">Address</p>
            <p className="text-xs font-mono text-cyan-300">{account ? shortenAddress(account) : "—"}</p>
          </div>
        </div>
      </div>

      {/* On-chain certificates */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Platform Certificates</p>
          {lastSynced && (
            <span className="text-[9px] text-gray-600">
              {Math.floor((Date.now() - new Date(lastSynced)) / 60000)}m ago
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {myNFTs.length === 0 ? (
            <p className="text-[11px] text-gray-600 py-2 text-center">No certificates earned yet</p>
          ) : (
            myNFTs.slice(0, 3).map((nft) => (
              <div key={nft.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <span className="text-sm">🏆</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">{nft.title}</p>
                  <p className="text-[9px] text-gray-500">{nft.category}</p>
                </div>
                <span className={`text-[9px] font-bold ${nft.statusLabel === "Completed" ? "text-green-400" : "text-yellow-400"}`}>
                  {nft.statusLabel}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Polygon NFTs */}
      {account && detectedNFTs.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-2">
            Detected Polygon NFTs
          </p>
          <div className="space-y-1.5">
            {detectedNFTs.map((nft, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <span className="text-sm">🖼️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">{nft.name || `NFT #${nft.token_id?.slice(0, 8)}`}</p>
                  <p className="text-[9px] text-gray-500">{nft.contract_type || "ERC-721"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="flex-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync Certificates"}
        </button>
        {account && (
          <button
            type="button"
            onClick={detectNFTs}
            disabled={detecting}
            className="flex-1 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-[10px] font-semibold text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
          >
            {detecting ? "Detecting..." : "Detect NFTs"}
          </button>
        )}
      </div>
    </div>
  );
}

export default WalletNFTStatus;
