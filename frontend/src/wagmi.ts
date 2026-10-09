import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// The dApp targets Ethereum Sepolia, chain id 11155111.
export const CHAIN_ID = sepolia.id; // 11155111
export const CHAIN_NAME = sepolia.name; // "Sepolia"

const rpcUrl = import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined;

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(rpcUrl && rpcUrl.length > 0 ? rpcUrl : undefined),
  },
});

// The deployed contract address (set in frontend/.env as VITE_GAME_ADDRESS).
export const GAME_ADDRESS = (import.meta.env.VITE_GAME_ADDRESS ?? "") as `0x${string}`;

export function hasContractAddress(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(GAME_ADDRESS);
}
