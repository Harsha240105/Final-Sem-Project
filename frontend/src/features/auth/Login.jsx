import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useConnect, useAccount, useSignMessage, useDisconnect, useSwitchChain } from "wagmi";
import { useAuth } from "../../shared/hooks/useAuth";
import { useToast } from "../../shared/hooks/useToast";
import { walletLogin, checkWallet, getAuthNonce, registerWallet } from "../../shared/services/api";


function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

const ROLES = [
  { id: "student", icon: "🎓", label: "Student", desc: "Join courses & earn NFTs", color: "cyan" },
  { id: "teacher", icon: "👨‍🏫", label: "Teacher", desc: "Create courses & issue NFTs", color: "purple" },
  { id: "admin", icon: "🏛️", label: "College Admin", desc: "Manage campus & verify users", color: "emerald" },
];

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { addToast } = useToast();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { address, isConnected, chainId, connector: activeConnector } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();

  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("login");
  const [step, setStep] = useState("connect");
  const [walletAddress, setWalletAddress] = useState("");
  const [signing, setSigning] = useState(false);
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [existingUser, setExistingUser] = useState(null);
  const [checking, setChecking] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const initialCheckDone = useRef(false);
  const cardRef = useRef(null);

  useEffect(() => {
    // Clear stale wagmi shimDisconnect flag that blocks autoConnect
    try { localStorage.removeItem('__MICROSOFT_DISCONNECT__'); } catch {}
    setMounted(true);
  }, []);



  // Keep walletAddress in sync with wagmi account
  useEffect(() => {
    if (isConnected && address) setWalletAddress(address);
  }, [isConnected, address]);

  // Auto-check wallet when already connected on page load.
  // Without this, a user with an already-connected wallet sees "Connect Wallet"
  // and clicking it triggers a disconnect/reconnect cycle that can cause race conditions.
  useEffect(() => {
    if (!mounted || !isConnected || !address || initialCheckDone.current) return;
    initialCheckDone.current = true;
    const doCheck = async () => {
      setChecking(true);
      try {
        const response = await checkWallet(address.toLowerCase());
        if (response?.exists) {
          setExistingUser(response.user);
          setStep(tab === "login" ? "welcome-back" : "exists");
        } else {
          setStep(tab === "login" ? "not-found" : "register");
        }
      } catch {
        setStep(tab === "login" ? "not-found" : "register");
      } finally {
        setChecking(false);
      }
    };
    doCheck();
  }, [mounted, isConnected, address]);

  const shortenAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const resetFlow = () => {
    setStep("connect");
    setWalletAddress("");
    setExistingUser(null);
    setSelectedRole(null);
    setName("");
  };

  const switchTab = (t) => { setTab(t); resetFlow(); };

  const metaMaskConnector = useMemo(() =>
    connectors.find((c) => c.id === "metaMask" || c.name === "MetaMask"),
    [connectors]
  );

  const doCheckAfterConnect = useCallback(async (account) => {
    if (!account) return;
    setWalletAddress(account);
    setChecking(true);
    try {
      const response = await checkWallet(account.toLowerCase());
      if (response?.exists) {
        setExistingUser(response.user);
        setStep(tab === "login" ? "welcome-back" : "exists");
      } else {
        setStep(tab === "login" ? "not-found" : "register");
      }
    } catch (err) {
      addToast(err?.response?.data?.error || err?.message || "Failed to check wallet", "error");
      setStep(tab === "login" ? "not-found" : "register");
    } finally {
      setChecking(false);
    }
  }, [tab, addToast]);

  const handleConnect = useCallback(async (connector) => {
    const target = connector || metaMaskConnector || connectors[0];
    if (!target) { addToast("No wallet connector available. Please install a wallet.", "error"); return; }
    try {
      // Disconnect first so MetaMask shows the account selection popup.
      // With shimDisconnect:false in wagmi config, this does NOT set the stale
      // localStorage flag that previously broke connections.
      if (isConnected) await disconnectAsync();
      const result = await connectAsync({ connector: target });
      const account = result?.accounts?.[0];
      if (!account) { addToast("No account found", "error"); return; }
      setWalletAddress(account);
      const connectedChainId = result?.chainId || chainId;
      if (connectedChainId && connectedChainId !== 80002) {
        try { await switchChainAsync({ chainId: 80002 }); } catch { /* user may reject chain switch */ }
      }
      await doCheckAfterConnect(account);
    } catch (err) {
      if (err?.code === 4001 || err?.name === "UserRejectedRequestError") {
        addToast("Connection cancelled", "info");
      } else if (err?.message?.includes("already connected")) {
        // Wallet reports already connected — use the address wagmi already has
        const fallbackAccount = address;
        if (fallbackAccount) {
          await doCheckAfterConnect(fallbackAccount);
        } else {
          addToast("Wallet is already connected. Try again.", "error");
        }
      } else {
        addToast(err?.message || "Failed to connect wallet", "error");
      }
    }
  }, [connectAsync, connectors, metaMaskConnector, tab, addToast, isConnected, address, disconnectAsync, switchChainAsync, doCheckAfterConnect]);

  const handleExistingLogin = useCallback(async () => {
    if (!walletAddress || !existingUser) return;
    setSigning(true);
    try {
      const nonceRes = await getAuthNonce();
      const nonce = nonceRes.nonce;
      const message = `Web3Connect Authentication\n\nWallet:\n${walletAddress.toLowerCase()}\n\nRole:\n${existingUser.role}\n\nNonce:\n${nonce}`;
      if (!activeConnector) {
        const target = metaMaskConnector || connectors[0];
        if (target) {
          await connectAsync({ connector: target });
        }
      }
      const signature = await signMessageAsync({ message });
      const result = await walletLogin({
        walletAddress: walletAddress.toLowerCase(), signature, message,
        role: existingUser.role,
      });
      if (result?.token) {
        login(result.token, result.user);
        addToast(`Welcome back, ${result.user?.name || existingUser.name}!`, "success");
        navigate("/", { replace: true });
      }
    } catch (err) {
      addToast(err?.response?.data?.error || err?.message || "Login failed", "error");
    } finally {
      setSigning(false);
    }
  }, [walletAddress, existingUser, login, addToast, navigate, signMessageAsync, activeConnector, metaMaskConnector, connectors, connectAsync]);

  const handleRegister = useCallback(async (role) => {
    if (!walletAddress) return;
    setSelectedRole(role);
    setSigning(true);
    try {
      const nonceRes = await getAuthNonce();
      const nonce = nonceRes.nonce;
      const message = `Web3Connect Authentication\n\nWallet:\n${walletAddress.toLowerCase()}\n\nRole:\n${role}\n\nNonce:\n${nonce}`;
      if (!activeConnector) {
        const target = metaMaskConnector || connectors[0];
        if (target) {
          const connResult = await connectAsync({ connector: target });
          if (!walletAddress && connResult?.accounts?.[0]) {
            setWalletAddress(connResult.accounts[0]);
          }
        }
      }
      const signature = await signMessageAsync({ message });
      const res = await registerWallet({
        address: walletAddress.toLowerCase(),
        signature,
        message,
        role,
        name: name.trim() || undefined,
        username: name.trim() || undefined,
      });
      if (res.data?.token) {
        login(res.data.token, res.data.user);
        addToast(`Welcome${res.data.user?.name ? `, ${res.data.user.name}` : ""}!`, "success");
        navigate(role === "admin" ? "/org-setup" : `/verify-${role}`, { replace: true });
      }
    } catch (err) {
      addToast(err?.response?.data?.message || err?.message || "Registration failed", "error");
    } finally {
      setSigning(false);
    }
  }, [walletAddress, name, login, addToast, navigate, signMessageAsync, activeConnector, metaMaskConnector, connectors, connectAsync]);

  if (!mounted) return null;

  return (
    <div className="relative flex min-h-screen overflow-hidden" style={{ background: "#060816" }}>
        {/* Animated galaxy background - subtle */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-cyan-900/10" />
        {/* Tiny particles */}
      </div>

      {/* Left Branding */}
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-3xl overflow-hidden bg-gradient-to-br from-cyan-500 to-purple-600 shadow-2xl shadow-cyan-500/40 mb-6 animate-pulse-glow">
            <img src="/logo.png" alt="OXK" className="h-14 w-14 object-contain" />
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-3 tracking-tight">
            Blockchain Enabled<br /><span className="text-gradient-cyan">Virtual Campus</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-sm mx-auto">
            The first blockchain-enabled virtual campus platform for education, verification, and collaboration
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(0,255,163,0.5)]" /> Decentralized</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,245,255,0.5)]" /> Verified</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(123,97,255,0.5)]" /> Gamified</span>
          </div>
        </motion.div>
      </div>

      {/* Right Auth Panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-4 relative z-10">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
          ref={cardRef}
        >
          <div className="glass-card-premium p-0 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />

            <div className="text-center lg:hidden pt-8 pb-2 px-8">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-500 to-purple-600 shadow-lg shadow-cyan-500/30 mb-3">
            <img src="/logo.png" alt="OXK" className="h-9 w-9 object-contain" />
              </div>
              <h1 className="text-xl font-extrabold text-white">OXK</h1>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/[0.06] px-8 pt-2">
              <button onClick={() => switchTab("login")}
                className={`flex-1 pb-3 text-sm font-bold transition relative ${tab === "login" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}>
                Login
                {tab === "login" && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full shadow-[0_0_8px_rgba(0,245,255,0.3)]" />}
              </button>
              <button onClick={() => switchTab("register")}
                className={`flex-1 pb-3 text-sm font-bold transition relative ${tab === "register" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}>
                Register
                {tab === "register" && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full shadow-[0_0_8px_rgba(0,245,255,0.3)]" />}
              </button>
            </div>

            <div className="p-8">
              <AnimatePresence mode="wait">
                {tab === "login" && (
                  <motion.div key="login" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
                    {step === "connect" && (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-400 text-center mb-2">Connect your wallet to sign in</p>
                        <motion.button onClick={() => handleConnect()} disabled={isConnecting}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          className="cyber-btn w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-3.5 text-sm font-bold text-white disabled:opacity-50 shadow-lg shadow-cyan-500/20 hover:shadow-[0_0_30px_rgba(0,245,255,0.2)] transition-all flex items-center justify-center gap-3">
                          {isConnecting ? (
                            <><span className="cyber-spinner inline-block h-4 w-4" /> Connecting...</>
                          ) : (
                            <><svg className="h-5 w-5" viewBox="0 0 35 33" fill="none"><path d="M32.9582 1L19.8241 10.9233L22.4374 5.24155L32.9582 1Z" fill="#E17726"/><path d="M2.04175 1L15.0989 10.991L12.5625 5.24155L2.04175 1Z" fill="#E27625"/><path d="M28.1502 23.435L25.0261 28.1953L31.8064 29.9445L33.6431 23.5103L28.1502 23.435Z" fill="#E27625"/><path d="M1.35693 23.5103L3.1857 29.9445L9.9581 28.1953L6.84978 23.435L1.35693 23.5103Z" fill="#E27625"/><path d="M9.57774 14.355L7.66748 17.2133L14.3939 17.5135L14.1899 10.3306L9.57774 14.355Z" fill="#E27625"/><path d="M25.4222 14.3549L20.7621 10.2629L20.6299 17.5134L27.3325 17.2132L25.4222 14.3549Z" fill="#E27625"/><path d="M9.95825 28.1955L14.0913 26.0243L10.4775 23.2539L9.95825 28.1955Z" fill="#D5BFB2"/><path d="M20.9087 26.0243L25.0259 28.1955L24.5304 23.2539L20.9087 26.0243Z" fill="#D5BFB2"/><path d="M25.0259 28.1956L20.9087 26.0244L21.2369 28.5018L21.2052 29.7337L25.0259 28.1956Z" fill="#233447"/><path d="M9.95825 28.1956L13.7869 29.7337L13.7631 28.5018L14.0913 26.0244L9.95825 28.1956Z" fill="#233447"/><path d="M13.8742 21.4287L10.3994 20.3922L12.8195 19.2441L13.8742 21.4287Z" fill="#CC6228"/><path d="M21.1258 21.4287L22.1805 19.2441L24.6085 20.3922L21.1258 21.4287Z" fill="#CC6228"/><path d="M9.95801 28.1954L10.501 23.4349L6.84961 23.5103L9.95801 28.1954Z" fill="#CC6228"/><path d="M24.507 23.4349L25.0259 28.1954L28.1503 23.5103L24.507 23.4349Z" fill="#CC6228"/><path d="M27.3325 17.2131L20.6299 17.5133L21.1338 21.4286L22.1805 19.2441L24.6085 20.3922L27.3325 17.2131Z" fill="#E27625"/><path d="M10.3994 20.3922L12.8195 19.2441L13.8742 21.4286L14.3939 17.5133L7.66748 17.2131L10.3994 20.3922Z" fill="#E27625"/><path d="M7.66748 17.2131L10.4775 23.2539L10.3994 20.3922L7.66748 17.2131Z" fill="#F5841F"/><path d="M24.6085 20.3922L24.5304 23.2539L27.3324 17.2131L24.6085 20.3922Z" fill="#F5841F"/><path d="M14.3939 17.5133L13.8742 21.4286L14.5225 25.9856L14.6547 20.5426L14.3939 17.5133Z" fill="#F5841F"/><path d="M20.6299 17.5133L20.426 20.5347L20.5567 25.9856L21.205 21.4287L20.6299 17.5133Z" fill="#F5841F"/><path d="M21.205 21.4287L20.5567 25.9856L24.5304 23.2537L24.5071 23.4348L27.3326 17.2131L21.205 21.4287Z" fill="#C0AC9D"/><path d="M14.5225 25.9856L13.8742 21.4287L7.66748 17.2131L10.4775 23.2537L14.5225 25.9856Z" fill="#C0AC9D"/><path d="M10.4775 23.2537L9.95825 28.1955L14.0913 26.0243L10.4775 23.2537Z" fill="#C0AC9D"/><path d="M24.5304 23.2537L25.0259 28.1955L20.9087 26.0243L24.5304 23.2537Z" fill="#C0AC9D"/><path d="M20.9087 26.0243L25.0259 28.1955L21.2052 29.7337L21.2369 28.5018L20.9087 26.0243Z" fill="#233447"/><path d="M14.0913 26.0243L9.95825 28.1955L13.7869 29.7337L13.7631 28.5018L14.0913 26.0243Z" fill="#233447"/><path d="M13.7869 29.7337L14.0913 26.0243L13.8742 21.4287L10.4775 23.2537L9.95825 28.1955L13.7869 29.7337Z" fill="#F5841F"/><path d="M20.5567 25.9856L20.9087 26.0243L21.2052 29.7337L25.0259 28.1955L24.5304 23.2537L20.5567 25.9856Z" fill="#F5841F"/></svg>
                              Connect Wallet</>
                          )}
                        </motion.button>
                        <button onClick={() => setShowWalletModal(true)}
                          className="w-full rounded-xl border border-white/[0.08] px-6 py-3 text-sm font-semibold text-gray-400 hover:border-cyan-500/30 hover:text-cyan-400 transition flex items-center justify-center gap-2">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>
                          Other Wallet Options
                        </button>
                      </div>
                    )}

                    {checking && (
                      <div className="flex flex-col items-center justify-center py-6 gap-3">
                        <div className="cyber-spinner h-8 w-8" />
                        <p className="text-sm text-gray-400">Checking wallet...</p>
                      </div>
                    )}

                    {step === "welcome-back" && existingUser && (
                      <div className="space-y-4">
                        <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 p-5 text-center">
                          <div className="text-4xl mb-3">👋</div>
                          <h2 className="text-lg font-bold text-white">Welcome Back!</h2>
                          <p className="text-sm text-gray-300 mt-1">{existingUser.name}</p>
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold capitalize ${
                              existingUser.role === "admin" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : existingUser.role === "teacher" ? "border-purple-500/30 bg-purple-500/10 text-purple-400" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${existingUser.role === "admin" ? "bg-emerald-400" : existingUser.role === "teacher" ? "bg-purple-400" : "bg-cyan-400"}`} />
                              {existingUser.role}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-3 font-mono">{shortenAddress(walletAddress)}</p>
                        </div>
                        <motion.button onClick={handleExistingLogin} disabled={signing}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          className="cyber-btn w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 shadow-lg shadow-cyan-500/20 hover:shadow-[0_0_30px_rgba(0,245,255,0.2)] transition flex items-center justify-center gap-2">
                          {signing ? <><span className="cyber-spinner inline-block h-4 w-4" /> Signing in...</> : "Sign In"}
                        </motion.button>
                        <p className="text-center text-[10px] text-gray-500">
                          Not you? <button onClick={() => switchTab("register")} className="text-cyan-400 hover:underline">Create new account</button>
                        </p>
                      </div>
                    )}

                    {step === "not-found" && (
                      <div className="space-y-4 text-center py-4">
                        <div className="text-4xl mb-2">🔍</div>
                        <h2 className="text-base font-bold text-white">Wallet Not Found</h2>
                        <p className="text-sm text-gray-400">No account found for this wallet. Please register first.</p>
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                          <p className="text-xs font-mono text-gray-400">{shortenAddress(walletAddress)}</p>
                        </div>
                        <motion.button onClick={() => switchTab("register")}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          className="cyber-btn w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition">
                          Create Account
                        </motion.button>
                        <button onClick={resetFlow} className="text-xs text-gray-500 hover:text-cyan-400 transition">
                          Try a different wallet
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                {tab === "register" && (
                  <motion.div key="register" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                    {step === "connect" && (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-400 text-center mb-2">Connect your wallet to create an account</p>
                        <motion.button onClick={() => handleConnect()} disabled={isConnecting}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          className="cyber-btn w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-3.5 text-sm font-bold text-white disabled:opacity-50 shadow-lg shadow-cyan-500/20 hover:shadow-[0_0_30px_rgba(0,245,255,0.2)] transition-all flex items-center justify-center gap-3">
                          {isConnecting ? (
                            <><span className="cyber-spinner inline-block h-4 w-4" /> Connecting...</>
                          ) : (
                            <><svg className="h-5 w-5" viewBox="0 0 35 33" fill="none"><path d="M32.9582 1L19.8241 10.9233L22.4374 5.24155L32.9582 1Z" fill="#E17726"/><path d="M2.04175 1L15.0989 10.991L12.5625 5.24155L2.04175 1Z" fill="#E27625"/><path d="M28.1502 23.435L25.0261 28.1953L31.8064 29.9445L33.6431 23.5103L28.1502 23.435Z" fill="#E27625"/><path d="M1.35693 23.5103L3.1857 29.9445L9.9581 28.1953L6.84978 23.435L1.35693 23.5103Z" fill="#E27625"/><path d="M9.57774 14.355L7.66748 17.2133L14.3939 17.5135L14.1899 10.3306L9.57774 14.355Z" fill="#E27625"/><path d="M25.4222 14.3549L20.7621 10.2629L20.6299 17.5134L27.3325 17.2132L25.4222 14.3549Z" fill="#E27625"/><path d="M9.95825 28.1955L14.0913 26.0243L10.4775 23.2539L9.95825 28.1955Z" fill="#D5BFB2"/><path d="M20.9087 26.0243L25.0259 28.1955L24.5304 23.2539L20.9087 26.0243Z" fill="#D5BFB2"/><path d="M25.0259 28.1956L20.9087 26.0244L21.2369 28.5018L21.2052 29.7337L25.0259 28.1956Z" fill="#233447"/><path d="M9.95825 28.1956L13.7869 29.7337L13.7631 28.5018L14.0913 26.0244L9.95825 28.1956Z" fill="#233447"/><path d="M13.8742 21.4287L10.3994 20.3922L12.8195 19.2441L13.8742 21.4287Z" fill="#CC6228"/><path d="M21.1258 21.4287L22.1805 19.2441L24.6085 20.3922L21.1258 21.4287Z" fill="#CC6228"/><path d="M9.95801 28.1954L10.501 23.4349L6.84961 23.5103L9.95801 28.1954Z" fill="#CC6228"/><path d="M24.507 23.4349L25.0259 28.1954L28.1503 23.5103L24.507 23.4349Z" fill="#CC6228"/><path d="M27.3325 17.2131L20.6299 17.5133L21.1338 21.4286L22.1805 19.2441L24.6085 20.3922L27.3325 17.2131Z" fill="#E27625"/><path d="M10.3994 20.3922L12.8195 19.2441L13.8742 21.4286L14.3939 17.5133L7.66748 17.2131L10.3994 20.3922Z" fill="#E27625"/><path d="M7.66748 17.2131L10.4775 23.2539L10.3994 20.3922L7.66748 17.2131Z" fill="#F5841F"/><path d="M24.6085 20.3922L24.5304 23.2539L27.3324 17.2131L24.6085 20.3922Z" fill="#F5841F"/><path d="M14.3939 17.5133L13.8742 21.4286L14.5225 25.9856L14.6547 20.5426L14.3939 17.5133Z" fill="#F5841F"/><path d="M20.6299 17.5133L20.426 20.5347L20.5567 25.9856L21.205 21.4287L20.6299 17.5133Z" fill="#F5841F"/><path d="M21.205 21.4287L20.5567 25.9856L24.5304 23.2537L24.5071 23.4348L27.3326 17.2131L21.205 21.4287Z" fill="#C0AC9D"/><path d="M14.5225 25.9856L13.8742 21.4287L7.66748 17.2131L10.4775 23.2537L14.5225 25.9856Z" fill="#C0AC9D"/><path d="M10.4775 23.2537L9.95825 28.1955L14.0913 26.0243L10.4775 23.2537Z" fill="#C0AC9D"/><path d="M24.5304 23.2537L25.0259 28.1955L20.9087 26.0243L24.5304 23.2537Z" fill="#C0AC9D"/><path d="M20.9087 26.0243L25.0259 28.1955L21.2052 29.7337L21.2369 28.5018L20.9087 26.0243Z" fill="#233447"/><path d="M14.0913 26.0243L9.95825 28.1955L13.7869 29.7337L13.7631 28.5018L14.0913 26.0243Z" fill="#233447"/><path d="M13.7869 29.7337L14.0913 26.0243L13.8742 21.4287L10.4775 23.2537L9.95825 28.1955L13.7869 29.7337Z" fill="#F5841F"/><path d="M20.5567 25.9856L20.9087 26.0243L21.2052 29.7337L25.0259 28.1955L24.5304 23.2537L20.5567 25.9856Z" fill="#F5841F"/></svg>
                              Connect Wallet</>
                          )}
                        </motion.button>
                        <button onClick={() => setShowWalletModal(true)}
                          className="w-full rounded-xl border border-white/[0.08] px-6 py-3 text-sm font-semibold text-gray-400 hover:border-cyan-500/30 hover:text-cyan-400 transition flex items-center justify-center gap-2">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>
                          Other Wallet Options
                        </button>
                      </div>
                    )}

                    {step === "exists" && existingUser && (
                      <div className="space-y-4 text-center py-2">
                        <div className="text-4xl mb-2">👋</div>
                        <h2 className="text-base font-bold text-white">Wallet Already Registered</h2>
                        <p className="text-sm text-gray-400">This wallet is already linked to an account.</p>
                        <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 p-4">
                          <p className="text-sm font-bold text-white">{existingUser.name}</p>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold text-cyan-400 capitalize mt-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />{existingUser.role}
                          </span>
                        </div>
                        <div className="flex gap-3">
                          <motion.button onClick={() => switchTab("login")}
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            className="cyber-btn flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition">Sign In</motion.button>
                        </div>
                        <button onClick={resetFlow} className="text-xs text-gray-500 hover:text-cyan-400 transition">Use a different wallet</button>
                      </div>
                    )}

                    {step === "register" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-green-400 to-cyan-400 flex items-center justify-center text-[8px] font-bold text-white shadow-[0_0_10px_rgba(0,255,163,0.3)]">✓</div>
                          <p className="text-sm font-bold text-white">Wallet Connected</p>
                        </div>
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white shadow-[0_0_12px_rgba(0,245,255,0.2)]">{getInitials(walletAddress)}</div>
                          <div>
                            <p className="text-sm font-mono text-white">{shortenAddress(walletAddress)}</p>
                            <p className="text-[10px] text-gray-500">Polygon Amoy</p>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Display Name</label>
                          <input value={name} onChange={(e) => setName(e.target.value)}
                            placeholder="Your full name"
                            className="cyber-input mt-1 w-full" />
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-widest font-semibold text-gray-500 mb-3">Select Account Type</p>
                          <div className="grid grid-cols-1 gap-2.5">
                            {ROLES.map((r) => (
                              <motion.button key={r.id} onClick={() => handleRegister(r.id)} disabled={signing}
                                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                                className={`w-full rounded-xl border p-3.5 text-left transition-all group flex items-center gap-3 ${
                                  selectedRole === r.id
                                    ? r.color === "emerald" ? "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_12px_rgba(0,255,163,0.05)]" : r.color === "purple" ? "border-purple-500/40 bg-purple-500/5 shadow-[0_0_12px_rgba(123,97,255,0.05)]" : "border-cyan-500/40 bg-cyan-500/5 shadow-[0_0_12px_rgba(0,245,255,0.05)]"
                                    : "border-white/[0.08] bg-white/[0.02] hover:border-cyan-500/30 hover:bg-cyan-500/5"
                                }`}>
                                <div className={`text-2xl ${selectedRole === r.id ? "scale-110" : ""} transition-transform`}>{r.icon}</div>
                                <div className="flex-1">
                                  <p className={`text-sm font-bold ${selectedRole === r.id ? "text-white" : "text-white group-hover:text-cyan-400"} transition`}>{r.label}</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">{r.desc}</p>
                                </div>
                                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition ${
                                  selectedRole === r.id
                                    ? r.color === "emerald" ? "border-emerald-400 bg-emerald-400" : r.color === "purple" ? "border-purple-400 bg-purple-400" : "border-cyan-400 bg-cyan-400 shadow-[0_0_6px_rgba(0,245,255,0.3)]"
                                    : "border-gray-600"
                                }`}>
                                  {selectedRole === r.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                </div>
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {signing && (
                          <div className="flex items-center justify-center gap-2 text-sm text-cyan-400">
                            <div className="cyber-spinner h-4 w-4" />
                            Signing message & creating account...
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Wallet Options Modal */}
      <AnimatePresence>
        {showWalletModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowWalletModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-xl bg-gradient-to-b from-gray-950 to-space-800 border border-white/[0.08] p-6 shadow-2xl shadow-black/50"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-white mb-4">Connect a Wallet</h2>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {connectors.map((c) => {
                  const id = c.id?.toLowerCase() || "";
                  const name = c.name || "";
                  const isMeta = id.includes("metamask") || name === "MetaMask";
                  const isTrust = id.includes("trust") || name.includes("Trust");
                  const isCoinbase = id.includes("coinbase") || name.includes("Coinbase");
                  const isWC = id.includes("walletconnect") || name.includes("WalletConnect");
                  const isOKX = id.includes("okx") || name.includes("OKX");
                  const isBrave = id.includes("brave") || name.includes("Brave");
                  const icon = isMeta ? "🦊" : isTrust ? "🔷" : isCoinbase ? "📱" : isOKX ? "🧩" : isBrave ? "🦁" : isWC ? "💼" : "🔌";
                  const color = isMeta ? "bg-orange-100" : isTrust || isCoinbase ? "bg-blue-100" : isOKX ? "bg-purple-100" : isBrave ? "bg-yellow-100" : isWC ? "bg-blue-100" : "bg-gray-100";
                  const providers = typeof window !== "undefined" && (window.ethereum?.providers || [window.ethereum].filter(Boolean));
                  const detected = c.ready || providers.some((p) =>
                    isMeta ? p.isMetaMask : isTrust ? p.isTrust : isCoinbase ? p.isCoinbaseWallet : isOKX ? p.isOKX || window.okxwallet : isBrave ? p.isBrave : false
                  );
                  return (
                    <button key={c.uid || c.id}
                      onClick={() => { setShowWalletModal(false); handleConnect(c); }}
                      disabled={isConnecting}
                      className="w-full flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition group disabled:opacity-50">
                      <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center text-lg shrink-0`}>{icon}</div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-sm font-bold text-white group-hover:text-cyan-400 transition truncate">{c.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {isWC ? "Connect via QR code or mobile app" : "Browser extension wallet"}
                        </p>
                      </div>
                      {detected ? (
                        <span className="ml-auto text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">Detected</span>
                      ) : (
                        <span className="ml-auto text-[9px] text-gray-500 bg-white/[0.04] px-2 py-0.5 rounded-full shrink-0">Not detected</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setShowWalletModal(false)}
                className="mt-4 w-full rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Login;
