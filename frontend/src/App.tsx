import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import Board from "./components/Board";
import { useGame } from "./hooks/useGame";
import { useSelectedChain } from "./useSelectedChain";
import { connectFourAbi, Status } from "./abi";
import { contractAddressFor, hasContractAddress } from "./wagmi";
import { SUPPORTED_CHAINS, getChainMeta, isSupportedChain } from "./chains";

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

// Map noisy provider/wallet messages to something a player can act on. Public
// Sepolia RPC endpoints commonly answer 429 ("Too Many Requests") in bursts;
// viem retries these automatically, so surface a clear, transient message
// instead of dumping raw JSON at the user.
function friendlyError(message: string): string {
  if (/429|too many requests|rate ?limit/i.test(message)) {
    return "The public RPC endpoint is rate-limiting requests (429). It retries automatically — wait a few seconds and try again, or set a private RPC URL in frontend/.env.";
  }
  return message.split("\n")[0];
}

export default function App() {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { selectedChainId, setSelectedChainId } = useSelectedChain();

  const selectedMeta = getChainMeta(selectedChainId);
  const gameAddress = contractAddressFor(selectedChainId);
  const configured = gameAddress !== undefined;
  const walletOnSelected = walletChainId === selectedChainId;
  const walletUnsupported = walletChainId !== undefined && !isSupportedChain(walletChainId);
  // Reads follow the selected chain; writes additionally require the wallet on
  // that same chain and a configured address there.
  const canWrite = isConnected && walletOnSelected && configured;

  const [gameId, setGameId] = useState<bigint | undefined>(undefined);
  const [gameIdInput, setGameIdInput] = useState("");

  const gameCount = useReadContract({
    address: gameAddress,
    abi: connectFourAbi,
    functionName: "gameCount",
    chainId: selectedChainId,
    query: { enabled: configured },
  });

  const { state, boardArray, timeoutSeconds, refetchAll, game: gameRead } = useGame(
    gameId,
    selectedChainId,
  );

  const { writeContract, data: txHash, isPending, error: writeError, reset } =
    useWriteContract();
  const { isLoading: txConfirming, isSuccess: txSuccess } =
    useWaitForTransactionReceipt({ hash: txHash, chainId: selectedChainId });

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
    if (!canWrite || !gameAddress) return;
    reset();
    writeContract({
      address: gameAddress,
      abi: connectFourAbi,
      functionName: "createGame",
      chainId: selectedChainId,
    });
  }

  function joinGame() {
    if (!canWrite || !gameAddress || gameId === undefined) return;
    writeContract({
      address: gameAddress,
      abi: connectFourAbi,
      functionName: "joinGame",
      args: [gameId],
      chainId: selectedChainId,
    });
  }

  function makeMove(column: number) {
    if (!canWrite || !gameAddress || gameId === undefined) return;
    writeContract({
      address: gameAddress,
      abi: connectFourAbi,
      functionName: "move",
      args: [gameId, column],
      chainId: selectedChainId,
    });
  }

  function claimTimeout() {
    if (!canWrite || !gameAddress || gameId === undefined) return;
    writeContract({
      address: gameAddress,
      abi: connectFourAbi,
      functionName: "claimTimeoutWin",
      args: [gameId],
      chainId: selectedChainId,
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
    canWrite && !!state && state.status === Status.InProgress && isMyTurn && !isPending && !txConfirming;

  const iAmActive = isMyTurn;
  const isPlayer = myPlayerId === 1 || myPlayerId === 2;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Turn by Turn</h1>
        <span className="subtitle">
          Onchain Connect Four · {selectedMeta ? selectedMeta.name : "Unknown network"}
        </span>
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

      <div className="network-picker">
        <span className="muted">Network:</span>
        {SUPPORTED_CHAINS.map((c) => (
          <button
            key={c.id}
            className={c.id === selectedChainId ? "net active" : "net"}
            onClick={() => setSelectedChainId(c.id)}
          >
            {c.name}
            {hasContractAddress(c.id) ? "" : " — not configured"}
          </button>
        ))}
      </div>

      {isConnected && walletUnsupported && (
        <div className="banner warn">
          Your wallet is on an unsupported network (chain {walletChainId}).{" "}
          <button onClick={() => switchChain({ chainId: selectedChainId })}>
            Switch to {selectedMeta ? selectedMeta.name : "the selected network"}
          </button>
        </div>
      )}

      {isConnected && !walletUnsupported && !walletOnSelected && (
        <div className="banner warn">
          Your wallet is on chain {walletChainId}, but the app is set to{" "}
          {selectedMeta ? selectedMeta.name : "another network"} (chain {selectedChainId}).{" "}
          <button onClick={() => switchChain({ chainId: selectedChainId })}>
            Switch wallet to {selectedMeta ? selectedMeta.shortName : "the selected network"}
          </button>
        </div>
      )}

      {!configured && selectedMeta && (
        <div className="banner warn">
          Not deployed/configured on {selectedMeta.name}. Set{" "}
          <code>{selectedMeta.addressEnv}</code> in <code>frontend/.env</code> to a deployed
          ConnectFour address on {selectedMeta.name} (chain {selectedMeta.id}). Addresses are
          per network and are never shared.
        </div>
      )}

      <section className="panel">
        <h2>Lobby</h2>
        <div className="row">
          <button disabled={!canWrite} onClick={createGame}>
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

          {!state && !gameRead.error && (
            <p className="muted">Loading game state from chain…</p>
          )}
          {!state && gameRead.error && (
            <p className="error">{friendlyError(gameRead.error.message)}</p>
          )}

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
                    disabled={!canWrite || myPlayerId === 1 || isPending || txConfirming}
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
          {writeError && <p className="error">{friendlyError(writeError.message)}</p>}
        </section>
      )}

      <footer className="foot">
        <span>
          Network: {selectedMeta ? `${selectedMeta.name} (${selectedMeta.id})` : "unknown"} ·
          Contract: {configured ? shortAddr(gameAddress) : "not configured on this network"}
        </span>
      </footer>
    </div>
  );
}
