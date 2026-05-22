import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import axios from "axios";
import { useToast } from "../hooks/useToast";
import { API_BASE_URL as API_URL } from "../services/api";

const WalletContext = createContext(null);

function getCurrentAuthUserId() {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem("token");
  if (!token) return null;
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload?.id || null;
  } catch {
    return null;
  }
}

function WalletProvider({ children }) {
  const { addToast } = useToast();
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending: wagmiConnecting } = useConnect();
  const isConnecting = wagmiConnecting;
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isMetaMaskInstalled = typeof window !== "undefined" && (
    window.ethereum?.providers?.some((p) => p.isMetaMask) ||
    window.ethereum?.isMetaMask ||
    false
  );

  const connectWallet = useCallback(async (connector) => {
    const targetConnector = connector || connectors.find((c) => c.id === "metaMask" || c.name === "MetaMask") || connectors[0];
    if (!targetConnector) { addToast("No wallet connector available", "error"); return null; }
    try {
      if (isConnected) await disconnectAsync();
      const result = await connectAsync({ connector: targetConnector });
      if (result?.accounts?.length > 0) {
        const connectedAccount = result.accounts[0];
        const connectedChainId = result?.chainId || chainId;
        if (connectedChainId && connectedChainId !== 80002) {
          try { await switchChainAsync({ chainId: 80002 }); } catch { /* user may reject */ }
        }
        addToast("Wallet connected", "success");

        const token = localStorage.getItem("token");
        if (token) {
          try {
            await axios.put(
              `${API_URL}/user/wallet`,
              { walletAddress: connectedAccount },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            window.dispatchEvent(new CustomEvent("wallet-updated"));
          } catch (saveErr) {
            console.error("Failed to save wallet to backend:", saveErr);
          }
        }
        return connectedAccount;
      }
      return null;
    } catch (err) {
      if (err?.code === 4001 || err?.name === "UserRejectedRequestError") {
        addToast("Connection cancelled", "info");
      } else if (err?.message?.includes("already connected")) {
        try {
          await disconnectAsync();
          const result = await connectAsync({ connector: targetConnector });
          if (result?.accounts?.[0]) {
            const connChainId = result?.chainId || chainId;
            if (connChainId && connChainId !== 80002) {
              try { await switchChainAsync({ chainId: 80002 }); } catch { /* ignore */ }
            }
            return result.accounts[0];
          }
        } catch { /* ignore */ }
      } else {
        addToast(err?.message || "Failed to connect wallet", "error");
      }
      return null;
    }
  }, [connectAsync, connectors, addToast, isConnected, disconnectAsync, switchChainAsync, chainId]);

  const disconnectWallet = useCallback(async () => {
    try {
      await disconnectAsync();
      addToast("Wallet disconnected", "info");
    } catch {
      addToast("Failed to disconnect", "error");
    }
  }, [disconnectAsync, addToast]);

  const switchToAmoy = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: 80002 });
      addToast("Switched to Polygon Amoy", "success");
    } catch (err) {
      if (err?.code === 4001 || err?.name === "UserRejectedRequestError") {
        addToast("Network switch cancelled", "info");
      } else {
        addToast("Failed to switch network", "error");
      }
    }
  }, [switchChainAsync, addToast]);

  const value = useMemo(
    () => ({
      account: address || "",
      networkName: chainId === 80002 ? "Polygon Amoy" : chainId === 80001 ? "Polygon Mumbai" : chainId === 137 ? "Polygon Mainnet" : "Unknown",
      connectWallet,
      disconnectWallet,
      switchToAmoy,
      isMetaMaskInstalled,
      isConnecting,
      isConnected: mounted && isConnected,
    }),
    [address, chainId, connectWallet, disconnectWallet, switchToAmoy, isMetaMaskInstalled, isConnecting, mounted, isConnected]
  );

  if (!mounted) return null;

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

WalletProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export { WalletContext, WalletProvider };
