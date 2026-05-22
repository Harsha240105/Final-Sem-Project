import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getUserCertificates, syncCertificateStatus } from "../../../../shared/services/api";
import { useToast } from "../../../../shared/hooks/useToast";

const POLYGON_EXPLORER = "https://amoy.polygonscan.com";

function normalize(nft) {
  const s = nft?.status || "issued";
  const m = { claimed: "Completed", completed: "Completed", issued: "Pending", failed: "Failed", tx_submitted: "Processing" };
  return {
    id: nft?.certificateId || nft?.tokenId || Math.random().toString(36),
    title: nft?.communityName || "Certificate",
    status: m[s] || "Pending",
    tokenId: nft?.tokenId,
    txHash: nft?.txHash,
    verifyPath: nft?.certificateId ? `/verify/${nft.certificateId}` : null,
    explorerUrl: nft?.txHash ? `${POLYGON_EXPLORER}/tx/${nft.txHash}` : null,
    date: nft?.mintedAt || nft?.issuedAt || null,
  };
}

function NFTCertificates() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getUserCertificates(token);
      const list = Array.isArray(data) ? data : [];
      setCerts(list.map(normalize).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const onUpdate = () => fetch();
    window.addEventListener("certificates-updated", onUpdate);
    return () => window.removeEventListener("certificates-updated", onUpdate);
  }, [fetch]);

  const handleSync = useCallback(async () => {
    try {
      setSyncing(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await syncCertificateStatus(token);
      const list = Array.isArray(data) ? data : [];
      setCerts(list.map(normalize).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
      addToast("Certificates synced", "success");
    } catch {
      addToast("Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  }, [addToast]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-14 rounded-lg shimmer-skeleton" />)}
      </div>
    );
  }

  if (certs.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
        <p className="text-xs text-gray-500">No certificates earned yet</p>
        <p className="text-[10px] text-gray-600 mt-1">Complete tasks to earn NFT certificates</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] text-gray-500 font-medium">{certs.length} earned</span>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-[10px] text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition"
        >
          {syncing ? "Syncing..." : "Sync"}
        </button>
      </div>
      {certs.slice(0, 4).map(cert => (
        <div
          key={cert.id}
          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20">
            <span className="text-sm">🏅</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{cert.title}</p>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium ${
                cert.status === "Completed" ? "text-green-400" :
                cert.status === "Pending" ? "text-yellow-400" :
                "text-red-400"
              }`}>{cert.status}</span>
              {cert.tokenId && (
                <span className="text-[10px] text-gray-500">Token #{cert.tokenId}</span>
              )}
            </div>
          </div>
          {cert.verifyPath && (
            <button
              onClick={() => navigate(cert.verifyPath)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 shrink-0"
            >
              View
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default NFTCertificates;
