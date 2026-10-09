# Turn by Turn — MVP Plan

Problem slug: `turn-by-turn` (Road to DevCon VIII)
Project folder: `N:\dev7\tbyt` (this folder only — never `dev7`, `pt`, or `sg`)

## 1. MVP goal and limited scope

**Goal:** An asynchronous, two-player Connect Four where the chain is the only
referee. Two people open / join a game, alternate moves whenever they like, close
the app between moves, and the contract alone decides the winner, draws, and
timeout forfeits. Many games run at once; the frontend recovers all state from
chain data on reopen.

**In scope**

- One Solidity contract storing many games keyed by game ID.
- Create/join, turn + legal-move enforcement, on-chain win detection from the
  stored board, terminal status, draw detection, timeout forfeit, indexed move
  events.
- Foundry contract tests covering all ten scored checks (incl. failure cases).
- A React + Vite + wagmi/viem frontend that shows the board, whose turn it is,
  and the result, and recovers state from chain on reload.
- Deploy script, README, `.env.example`.

**Out of scope (deferred):** accounts/social login, tokens/economies, matchmaking,
rankings, notifications, elaborate artwork, chat, spectator mode.

## 2. Network directive (IMPORTANT)

The operator for this session directs **Ethereum Sepolia, chain ID `11155111`**,
tested with desktop MetaMask. This overrides the generic "Base Sepolia" line in
the shared brief. The scored rubric's check #1 text mentions Base Sepolia; that
conflict is recorded in Risks. Per the operator's explicit instruction we
configure **only Ethereum Sepolia** and do not configure any other chain.

## 3. Architecture and file structure

```
tbyt/
  foundry.toml               Foundry config (solc 0.8.24)
  remappings.txt
  .gitignore
  .env.example               Placeholders only (never real keys)
  README.md                  Setup / test / deploy / play (Sepolia + MetaMask)
  plan.md                    This file
  PROGRESS.md                Durable session handoff log
  src/ConnectFour.sol        The game contract
  test/ConnectFour.t.sol     Contract tests (all 10 scored checks)
  script/Deploy.s.sol        Deployment script
  frontend/
    package.json             React + Vite + wagmi + viem
    vite.config.ts
    tsconfig.json
    index.html
    .env.example             VITE_GAME_ADDRESS placeholder
    src/main.tsx
    src/App.tsx
    src/wagmi.ts             Chain config = Ethereum Sepolia (11155111)
    src/abi.ts               Contract ABI + address helper
    src/hooks/useGame.ts     Reads game + board from chain, polls for updates
    src/components/Board.tsx  7x6 board render + column-drop buttons
    src/components/Lobby.tsx  Create / join / open a game by id
```

**Contract design**

- `struct Game { player1, player2, currentTurn, winner, Status status,
  uint64 lastMoveTime, uint16 moveCount, uint8[42] board }`, stored in
  `mapping(uint256 => Game) games`; `uint256 gameCount`.
- `Status { WaitingForOpponent, InProgress, Finished }`.
- `uint256 constant MOVE_TIMEOUT = 1 days` (fixed; measured from `lastMoveTime`).
- `board` index = `row * COLS + column`, row 0 = bottom, `0` empty, `1` p1, `2` p2.

## 4. Requirement-to-implementation checklist (all 10 scored checks)

| # | Scored check | Where implemented | Status |
|---|--------------|-------------------|--------|
| 1 | Frontend targets Ethereum Sepolia (operator override) | `frontend/src/wagmi.ts`, `frontend/src/abi.ts` | DONE |
| 2 | No credential in any tracked file | `.gitignore`, `.env.example`, no keys | DONE (verified) |
| 3 | Move rejects caller not on turn | `ConnectFour.move` `require(msg.sender == currentTurn)` | DONE (verified) |
| 4 | Move rejects illegal placement (range/full) | `ConnectFour.move` `column < COLS`, `_lowestEmptyRow` full check | DONE (verified) |
| 5 | Winner set by contract board check | `ConnectFour._isWinningMove` over stored `board` | DONE (verified) |
| 6 | No move accepted after game ended | `ConnectFour.move` `require(status == InProgress)` | DONE (verified) |
| 7 | Stalled game forfeitable after deadline | `ConnectFour.claimTimeoutWin` (non-active player, `> lastMoveTime + MOVE_TIMEOUT`) | DONE (verified) |
| 8 | Many games run at once | `mapping(uint256 => Game)` + `gameCount` | DONE (verified) |
| 9 | Each move emits event identifying game | `event MoveMade(uint256 indexed gameId, ...)` | DONE (verified) |
| 10 | Game ends when no legal move remains (draw) | `ConnectFour.move` `moveCount == 42` → Finished | DONE (verified) |

Deployment to Sepolia: **NOT DONE** — no funded key/RPC available; documented in README.

## 5. Task breakdown

**Contract (`src/ConnectFour.sol`)**
- create/join, move, claimTimeoutWin, getGame, getBoard, timeUntilTimeout.
- Events: GameCreated, GameJoined, MoveMade, GameFinished, TimeoutClaimed.

**Tests (`test/ConnectFour.t.sol`)** — one+ test per scored check + failure cases:
wrong turn revert, out-of-range column revert, full-column revert, win detection
(horizontal/vertical/both diagonals), move-after-finish revert, early timeout
revert, timeout-by-active-player revert, valid timeout claim, many concurrent
games, indexed move event, board-full draw.

**Deployment (`script/Deploy.s.sol`)**
- Forge script deploying `ConnectFour`; uses `PRIVATE_KEY` + `SEPOLIA_RPC_URL`
  from env (never committed).

**Frontend (`frontend/`)**
- Sepolia-only chain config; connect MetaMask via injected connector.
- Lobby: create game, join by id, open game by id.
- Board: render 7x6 from `getBoard`, drop into a column via `move`.
- Status: whose turn, result, timeout countdown from `timeUntilTimeout`.
- Recover from chain on reopen; poll contract state so an open page updates.

**Docs**
- README: install, test, deploy, connect MetaMask, get Sepolia ETH, play.
- `.env.example` (root and frontend) with placeholders only.

## 6. Time-boxed sequence (30-hour window)

1. (0–1h) Harness + toolchain (Foundry) setup, plan/progress. **[done]**
2. (1–5h) Contract implementation.
3. (5–10h) Foundry tests for all ten checks; get suite green.
4. (10–18h) Frontend scaffold, chain config, lobby, board, status views.
5. (18–24h) Wire reading/writing to chain; reopen/poll recovery.
6. (24–28h) README, `.env.example`, credential sweep, final test run.
7. (28–30h) Buffer: fix failures, deploy if credentials available, document.

## 7. Risks, assumptions, blockers

- **Network conflict:** rubric says Base Sepolia; operator says Ethereum Sepolia.
  *Following operator:* Ethereum Sepolia `11155111` only. Recorded for reviewer.
- **Knowledge graph empty:** all `loops knowledge query` calls returned no
  evidence; the brief in `p1.md` is treated as authoritative.
- **Foundry not preinstalled:** installed v1.8.1 to `~/.foundry/bin` manually.
- **Deployment credentials:** none provided. If no funded Sepolia key + RPC is
  available, local build/tests are completed and the deploy step is documented as
  pending (no false success claims).
- **Node:** v22.22.0 satisfies the 20.12+ requirement.
