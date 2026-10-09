import { useMemo } from "react";
import { useReadContract, useWatchContractEvent } from "wagmi";
import { connectFourAbi } from "../abi";
import { GAME_ADDRESS, hasContractAddress } from "../wagmi";

export interface GameState {
  player1: `0x${string}`;
  player2: `0x${string}`;
  currentTurn: `0x${string}`;
  winner: `0x${string}`;
  status: number;
  lastMoveTime: bigint;
  moveCount: number;
}

export function useGame(gameId?: bigint) {
  const enabled = gameId !== undefined && hasContractAddress();
  const args = useMemo(
    () => (gameId !== undefined ? ([gameId] as const) : undefined),
    [gameId],
  );

  const game = useReadContract({
    address: GAME_ADDRESS,
    abi: connectFourAbi,
    functionName: "getGame",
    args,
    query: { enabled, refetchInterval: 6000 },
  });

  const board = useReadContract({
    address: GAME_ADDRESS,
    abi: connectFourAbi,
    functionName: "getBoard",
    args,
    query: { enabled, refetchInterval: 6000 },
  });

  const timeout = useReadContract({
    address: GAME_ADDRESS,
    abi: connectFourAbi,
    functionName: "timeUntilTimeout",
    args,
    query: { enabled, refetchInterval: 3000 },
  });

  const refetchAll = () => {
    game.refetch();
    board.refetch();
    timeout.refetch();
  };

  // Live updates: any chain event for this game refreshes the view, so an open
  // page changes without a reload.
  useWatchContractEvent({
    address: GAME_ADDRESS,
    abi: connectFourAbi,
    eventName: "MoveMade",
    enabled,
    onLogs: refetchAll,
  });
  useWatchContractEvent({
    address: GAME_ADDRESS,
    abi: connectFourAbi,
    eventName: "GameJoined",
    enabled,
    onLogs: refetchAll,
  });
  useWatchContractEvent({
    address: GAME_ADDRESS,
    abi: connectFourAbi,
    eventName: "GameFinished",
    enabled,
    onLogs: refetchAll,
  });
  useWatchContractEvent({
    address: GAME_ADDRESS,
    abi: connectFourAbi,
    eventName: "TimeoutClaimed",
    enabled,
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
