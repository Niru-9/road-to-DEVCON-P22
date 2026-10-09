import { useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import Board from "./components/Board";
import { useGame } from "./hooks/useGame";
import { connectFourAbi, Status } from "./abi";
import { GAME_ADDRESS, hasContractAddress } from "./wagmi";

function shortAddr(a?: string): string {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtSeconds(seconds: bigint): string {
  const s = Number(seconds);
  if (s <= 0) return "now";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [gameId, setGameId] = useState<bigint | undefined>(undefined);
  const [gameIdInput, setGameIdInput] = useState("");

  const gameCount = useReadContract({
    address: GAME_ADDRESS,
    abi: connectFourAbi,
    functionName: "gameCount",
    query: { enabled: hasContractAddress() },
  });

  const { state, boardArray, timeoutSeconds, refetchAll } = useGame(gameId);

  const { writeContract, data: txHash, isPending, error: writeError, reset } =
    useWriteContract();
  const { isLoading: txConfirming, isSuccess: txSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  // After a create-tx confirms, open the newly created game (id == gameCount).
  useEffect(() => {
    if (txSuccess) {
      gameCount.refetch().then((r) => {
        const count = r.data as bigint | undefined;
        if (count && count > 0n) setGameId(count);
      });
      refetchAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txSuccess, txHash]);

  const onWrongChain = isConnected && chainId !== sepolia.id;

  function openGameById() {
    try {
      const id = BigInt(gameIdInput.trim());
      if (id > 0n) {
        reset();
        setGameId(id);
      }
    } catch {
      /* ignore invalid input */
    }
  }

  function createGame() {
    reset();
    writeContract({ address: GAME_ADDRESS, abi: connectFourAbi, functionName: "createGame" });
  }

  function joinGame() {
    if (gameId === undefined) return;
    writeContract({
      address: GAME_ADDRESS,
      abi: connectFourAbi,
      functionName: "joinGame",
      args: [gameId],
    });
  }

  function makeMove(column: number) {
    if (gameId === undefined) return;
    writeContract({
      address: GAME_ADDRESS,
      abi: connectFourAbi,
      functionName: "move",
      args: [gameId, column],
    });
  }

  function claimTimeout() {
    if (gameId === undefined) return;
    writeContract({
      address: GAME_ADDRESS,
      abi: connectFourAbi,
      functionName: "claimTimeoutWin",
      args: [gameId],
    });
  }

  const myPlayerId =
    address && state
      ? address.toLowerCase() === state.player1.toLowerCase()
        ? 1
        : address.toLowerCase() === state.player2.toLowerCase()
          ? 2
          : 0
      : 0;

  const isMyTurn =
    !!address && !!state && state.currentTurn.toLowerCase() === address.toLowerCase();
  const canPlay =
    !!state && state.status === Status.InProgress && isMyTurn && !isPending && !txConfirming;

  const iAmActive = isMyTurn;
  const isPlayer = myPlayerId === 1 || myPlayerId === 2;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Turn by Turn</h1>
        <span className="subtitle">Onchain Connect Four · Ethereum Sepolia</span>
        <div className="wallet">
          {isConnected ? (
            <>
              <span className="pill">{shortAddr(address)}</span>
              <button onClick={() => disconnect()}>Disconnect</button>
            </>
          ) : (
            <button
              disabled={connectPending}
              onClick={() => connect({ connector: connectors[0] })}
            >
              Connect MetaMask
            </button>
          )}
        </div>
      </header>

      {onWrongChain && (
        <div className="banner warn">
          Wrong network. This app runs on {sepolia.name} (chain {sepolia.id}).{" "}
          <button onClick={() => switchChain({ chainId: sepolia.id })}>Switch to Sepolia</button>
        </div>
      )}

      {!hasContractAddress() && (
        <div className="banner warn">
          No contract address configured. Set <code>VITE_GAME_ADDRESS</code> in{" "}
          <code>frontend/.env</code> to a deployed ConnectFour address.
        </div>
      )}

      <section className="panel">
        <h2>Lobby</h2>
        <div className="row">
          <button disabled={!isConnected || !hasContractAddress()} onClick={createGame}>
            Create a new game
          </button>
          <span className="muted">
            Games so far: {gameCount.data !== undefined ? String(gameCount.data) : "—"}
          </span>
        </div>
        <div className="row">
          <input
            placeholder="Game id"
            value={gameIdInput}
            onChange={(e) => setGameIdInput(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <button disabled={!gameIdInput} onClick={openGameById}>
            Open game
          </button>
        </div>
      </section>

      {gameId !== undefined && (
        <section className="panel game">
          <h2>
            Game #{String(gameId)}{" "}
            {state && (
              <span className={`status status-${state.status}`}>
                {state.status === Status.WaitingForOpponent && "waiting for opponent"}
                {state.status === Status.InProgress && "in progress"}
                {state.status === Status.Finished && "finished"}
              </span>
            )}
          </h2>

          {!state && <p className="muted">Loading game state from chain…</p>}

          {state && (
            <>
              <div className="meta">
                <span>Player 1: <b>{shortAddr(state.player1)}</b>{myPlayerId === 1 ? " (you)" : ""}</span>
                <span>
                  Player 2:{" "}
                  {state.player2 === "0x0000000000000000000000000000000000000000"
                    ? "—"
                    : shortAddr(state.player2)}
                  {myPlayerId === 2 ? " (you)" : ""}
                </span>
                <span>Moves: {state.moveCount}</span>
              </div>

              <div className="turnline">
                {state.status === Status.WaitingForOpponent &&
                  "Waiting for a second player to join this game."}
                {state.status === Status.InProgress && (
                  <>
                    {isMyTurn ? <b className="your-turn">Your turn</b> : "Opponent's turn"}
                    {" — current turn: "}
                    {shortAddr(state.currentTurn)}
                  </>
                )}
                {state.status === Status.Finished && (
                  <b>
                    {state.winner === "0x0000000000000000000000000000000000000000"
                      ? "Draw — no legal move remains."
                      : (myPlayerId === 1 && state.winner === state.player1) ||
                          (myPlayerId === 2 && state.winner === state.player2)
                        ? "You won!"
                        : `Won by ${shortAddr(state.winner)}`}
                  </b>
                )}
              </div>

              {boardArray && (
                <Board
                  cells={boardArray}
                  onDrop={makeMove}
                  canPlay={!!canPlay}
                  lastMove={null}
                />
              )}

              <div className="controls">
                {state.status === Status.WaitingForOpponent && (
                  <button
                    disabled={!isConnected || myPlayerId === 1 || isPending || txConfirming}
                    onClick={joinGame}
                  >
                    Join this game as player 2
                  </button>
                )}
                {state.status === Status.InProgress && (
                  <span className="muted">
                    {isPlayer && !iAmActive && timeoutSeconds !== undefined
                      ? `Opponent may be forfeited in ${fmtSeconds(timeoutSeconds)}`
                      : `Move timeout: ${fmtSeconds(timeoutSeconds ?? 0n)} left`}
                  </span>
                )}
                {state.status === Status.InProgress && isPlayer && !iAmActive && (
                  <button
                    disabled={(timeoutSeconds ?? 1n) > 0n || isPending || txConfirming}
                    onClick={claimTimeout}
                  >
                    Claim win (opponent timed out)
                  </button>
                )}
              </div>
            </>
          )}

          {(isPending || txConfirming) && <p className="muted">Submitting transaction…</p>}
          {txHash && <p className="muted">Tx: {shortAddr(txHash)}</p>}
          {writeError && (
            <p className="error">
              {writeError.message.split("\n")[0]}
            </p>
          )}
        </section>
      )}

      <footer className="foot">
        <span>
          Contract: {hasContractAddress() ? shortAddr(GAME_ADDRESS) : "not configured"}
        </span>
      </footer>
    </div>
  );
}
