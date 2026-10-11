import { useMemo } from "react";
import { useReadContract, useWatchContractEvent } from "wagmi";
import { connectFourAbi } from "../abi";
import { contractAddressFor } from "../wagmi";

// One shared, deliberately slow cadence for both the periodic reads and the
// event watchers. Public Sepolia RPC endpoints rate-limit (HTTP 429) long before
// a human cares about sub-15s freshness, and an open game already refreshes
// immediately on an event or on the player's own confirmed write.
const READ_REFETCH_MS = 15_000;
const EVENT_POLL_MS = 15_000;

export interface GameState {
  player1: `0x${string}`;
  player2: `0x${string}`;
  currentTurn: `0x${string}`;
  winner: `0x${string}`;
  status: number;
  lastMoveTime: bigint;
  moveCount: number;
}

export function useGame(gameId: bigint | undefined, chainId: number) {
  // Reads and events are pinned to the app's selected chain, independent of
  // which chain the wallet happens to be on.
  const address = contractAddressFor(chainId);
  const enabled = gameId !== undefined && address !== undefined;
  const args = useMemo(
    () => (gameId !== undefined ? ([gameId] as const) : undefined),
    [gameId],
  );

  const game = useReadContract({
    address,
    abi: connectFourAbi,
    functionName: "getGame",
    args,
    chainId,
    query: { enabled, refetchInterval: READ_REFETCH_MS },
  });

  const board = useReadContract({
    address,
    abi: connectFourAbi,
    functionName: "getBoard",
    args,
    chainId,
    query: { enabled, refetchInterval: READ_REFETCH_MS },
  });

  const timeout = useReadContract({
    address,
    abi: connectFourAbi,
    functionName: "timeUntilTimeout",
    args,
    chainId,
    query: { enabled, refetchInterval: READ_REFETCH_MS },
  });

  const refetchAll = () => {
    game.refetch();
    board.refetch();
    timeout.refetch();
  };

  // Live updates. To stay well under public-RPC rate limits we use two watchers
  // (not four) and a slower poll shared with the reads:
  //   - MoveMade covers every move, including a winning/drawing final move (the
  //     contract emits GameFinished alongside that MoveMade), so it refreshes
  //     the board, the turn and the result in one event.
  //   - GameJoined lets the opening player see the opponent join promptly.
  // A timeout claim (rare, no MoveMade) is picked up by the slow poll; the
  // acting player's own write also triggers refetchAll() from App.tsx.
  useWatchContractEvent({
    address,
    abi: connectFourAbi,
    eventName: "MoveMade",
    chainId,
    enabled,
    pollingInterval: EVENT_POLL_MS,
    onLogs: refetchAll,
  });
  useWatchContractEvent({
    address,
    abi: connectFourAbi,
    eventName: "GameJoined",
    chainId,
    enabled,
    pollingInterval: EVENT_POLL_MS,
    onLogs: refetchAll,
  });

  const state: GameState | undefined = useMemo(() => {
    const d = game.data as
      | readonly [
          `0x${string}`,
          `0x${string}`,
          `0x${string}`,
          `0x${string}`,
          number,
          bigint,
          number,
        ]
      | undefined;
    if (!d) return undefined;
    return {
      player1: d[0],
      player2: d[1],
      currentTurn: d[2],
      winner: d[3],
      status: Number(d[4]),
      lastMoveTime: BigInt(d[5]),
      moveCount: Number(d[6]),
    };
  }, [game.data]);

  const boardArray: number[] | undefined = useMemo(() => {
    const b = board.data as readonly number[] | undefined;
    return b ? b.map((v) => Number(v)) : undefined;
  }, [board.data]);

  return { game, state, boardArray, timeoutSeconds: timeout.data as bigint | undefined, refetchAll };
}
