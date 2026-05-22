import { useContext } from "react";
import { WalletContext } from "../components/WalletContext";

function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}

export { useWallet };
