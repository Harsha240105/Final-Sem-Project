import { createConfig, http } from "wagmi";
import { polygonAmoy, polygon } from "wagmi/chains";
import { metaMask, walletConnect, coinbaseWallet } from "wagmi/connectors";

const WC_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

export const config = createConfig({
  autoConnect: false,
  chains: [polygonAmoy, polygon],
  transports: {
    [polygonAmoy.id]: http("https://rpc-amoy.polygon.technology"),
    [polygon.id]: http("https://polygon-rpc.com"),
  },
  connectors: [
    metaMask({ shimDisconnect: false }),
    coinbaseWallet({ appName: "Web3Connect" }),
    walletConnect({ projectId: WC_PROJECT_ID, showQrModal: false }),
  ],
  multiInjectedProviderDiscovery: true,
});
