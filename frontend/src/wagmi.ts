import { createConfig, http } from "wagmi";
import { baseSepolia, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { type EnvRecord, resolveAddress, resolveRpcUrl } from "./chains";

const env = import.meta.env as unknown as EnvRecord;

// Public Sepolia endpoints rate-limit (HTTP 429) under bursts of reads plus a
// wallet write. viem already retries 429/timeout responses; we widen the retry
// budget and add spacing so a transient limit is ridden out instead of
// surfacing as a failed join/move. Keeping the request *rate* low is handled by
// the read intervals in hooks/useGame.ts, not by adding more requests here.
const RPC_RETRY_COUNT = 6;
const RPC_RETRY_DELAY_MS = 750;
const RPC_TIMEOUT_MS = 20_000;

function transportFor(chainId: number) {
  return http(resolveRpcUrl(chainId, env), {
    retryCount: RPC_RETRY_COUNT,
    retryDelay: RPC_RETRY_DELAY_MS,
    timeout: RPC_TIMEOUT_MS,
  });
}

// Both networks are configured, each with its own RPC transport. Ethereum
// Sepolia is listed first, so it is the default chain when no wallet is
// connected.
export const wagmiConfig = createConfig({
  chains: [sepolia, baseSepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: transportFor(sepolia.id),
    [baseSepolia.id]: transportFor(baseSepolia.id),
  },
});

/**
 * The deployed ConnectFour address for one chain, resolved strictly from that
 * chain's own env var. Returns undefined when that chain has no address, so the
 * UI can show a "not configured on this network" state rather than using a
 * different chain's deployment.
 */
export function contractAddressFor(chainId: number): `0x${string}` | undefined {
  const value = resolveAddress(chainId, env);
  return value === "" ? undefined : (value as `0x${string}`);
}

export function hasContractAddress(chainId: number): boolean {
  return resolveAddress(chainId, env) !== "";
}
