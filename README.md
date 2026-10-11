# Turn by Turn — Onchain Connect Four

A two-player, turn-based Connect Four where **the chain is the referee**. Two
people open/join a game, take turns while the game is live, close the app
between moves, and the contract alone decides the winner, draws and timeout
forfeits. Many games run at once, and the frontend rebuilds its view entirely
from chain data whenever it is reopened.

> **Networks:** The contract is plain EVM Solidity and the front end is
> **dual-network**: it can talk to **Ethereum Sepolia (`11155111`)** and **Base
> Sepolia (`84532`)**, each with its own contract address and RPC that are never
> shared. **Ethereum Sepolia is our deployment and manual-verification target.**
> (The original rubric names Base Sepolia; using Ethereum Sepolia is a documented
> deviation, not a code defect.) Base Sepolia is supported/configurable for a
> separate deployment by someone who has Base Sepolia test ETH — **we have not
> deployed to or verified it.**

---

## Repository layout

```
.
├── src/ConnectFour.sol        The game contract (Solidity 0.8.24)
├── test/ConnectFour.t.sol     Foundry tests covering all scored checks
├── script/Deploy.s.sol        Deployment script (network-agnostic; Sepolia default)
├── foundry.toml               Foundry config
├── .env.example               Root env placeholders (RPC + key)
├── frontend/                  React + Vite + wagmi + viem app
│   ├── src/chains.ts          Dual-network registry: per-chain address/RPC
│   ├── src/useSelectedChain.ts App-level network selection (persisted)
│   ├── src/wagmi.ts           wagmi config for both chains
│   ├── src/abi.ts             Contract ABI
│   ├── src/hooks/useGame.ts   Reads game + board from the selected chain
│   ├── src/components/Board.tsx
│   ├── test/chains.test.ts    node:test unit tests (chain config + guards)
│   └── .env.example           Frontend env placeholders
├── plan.md                    MVP plan
└── PROGRESS.md                Build/session log
```

---

## Prerequisites

- **Node.js 20.12+** (22 LTS recommended) — `node -v`
- **Foundry** (for the contract) — see https://book.getfoundry.sh/getting-started/installation
- **MetaMask** browser extension (desktop) — https://metamask.io/download/
- Sepolia test ETH (free, see below)

---

## 1. Contract: build & test

```bash
# from the project root
forge build
forge test -vv        # runs the full suite (see "Test coverage" below)
```

`forge install` already vendored `forge-std` into `lib/`. If you cloned without
submodules, run `forge install foundry-rs/forge-std`.

## 2. Contract: deploy

The same `ConnectFour` source deploys unchanged to any EVM network. **Our target
is Ethereum Sepolia**; Base Sepolia is optional (see §4).

You can deploy either through **Remix + MetaMask** (no key handling in this repo,
matches the MetaMask-based manual test requirement) or the Foundry script.

### 2a. Remix + injected MetaMask (recommended)

> This manual procedure has **not** been executed in this coding phase — treat it
> as the documented plan, not a tested result.

1. Install MetaMask and switch it to **Sepolia**. Enable *Settings → Advanced →
   Show test networks*, then pick **Sepolia** (chain ID `11155111`). Get free
   Sepolia ETH from a faucet (see below).
2. Open https://remix.ethereum.org and create a new file, then paste the contents
   of `src/ConnectFour.sol` (source path `src/ConnectFour.sol`, contract name
   `ConnectFour`).
3. In the **Solidity Compiler** tab select compiler **0.8.24** (the version pinned
   in `foundry.toml`) and click **Compile**.
4. In the **Deploy & Run Transactions** tab set **Environment** to
   **Injected Provider - MetaMask**, confirm MetaMask shows Sepolia
   (`11155111`), then click **Deploy**. `ConnectFour` takes **no constructor
   arguments**.
5. Copy the deployed address and record the **deploy block** (from the Sepolia
   explorer transaction) for your own reference.
6. Put the address in `VITE_SEPOLIA_GAME_ADDRESS` in `frontend/.env` (§3) and
   update the deployment status below.

### 2b. Foundry script

```bash
cp .env.example .env         # then edit .env with your own values
# .env:
#   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<your-key>   (or any Sepolia RPC)
#   PRIVATE_KEY=0x<throwaway-test-key>

forge script script/Deploy.s.sol \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast --private-key "$PRIVATE_KEY"
```

The script prints `ConnectFour deployed at: 0x…`. Copy that address into
`frontend/.env` as `VITE_SEPOLIA_GAME_ADDRESS`.

> `.env` is git-ignored. Only `.env.example` (placeholders) is tracked. Never
> commit a private key, mnemonic, API key, or a key-bearing RPC URL.

### Deployment status

No deployment has been recorded in this repo yet (no funded Sepolia key was
available at build time). Complete the command above and paste the resulting
address into `frontend/.env` and here:

```
ConnectFour (Ethereum Sepolia): <not deployed yet>
ConnectFour (Base Sepolia):     <not deployed — optional, not verified by us>
```

---

## 3. Frontend: install & run

```bash
cd frontend
npm install
cp .env.example .env
# .env:
#   VITE_SEPOLIA_GAME_ADDRESS=0x<your deployed contract on Ethereum Sepolia>
#   VITE_SEPOLIA_RPC_URL=               (optional; public default used if empty)
#   VITE_BASE_SEPOLIA_GAME_ADDRESS=     (optional; only if separately deployed)
#   VITE_BASE_SEPOLIA_RPC_URL=          (optional; public default used if empty)

npm run dev        # http://localhost:5173
npm test           # node:test — chain config, per-chain address, wrong-network guards
npm run build      # type-check + production build
```

---

## 4. Network configuration (dual-network)

Both networks are configured, each with its **own** contract address and RPC.
Addresses are per network and are **never** shared or guessed.

| Network | Chain ID | Contract address env | RPC env |
|---|---|---|---|
| **Ethereum Sepolia** (our target) | `11155111` | `VITE_SEPOLIA_GAME_ADDRESS` | `VITE_SEPOLIA_RPC_URL` |
| Base Sepolia (optional) | `84532` | `VITE_BASE_SEPOLIA_GAME_ADDRESS` | `VITE_BASE_SEPOLIA_RPC_URL` |

- The in-app **Network** selector switches which chain the app reads from, and the
  choice is remembered across reloads. Ethereum Sepolia is the default.
- Reads and live events always target the **selected** chain. A transaction is
  only allowed when the connected wallet is on that same chain — otherwise the app
  shows a "Switch wallet" prompt and blocks the action.
- If the selected chain has no configured address, the app shows a clear
  **"Not deployed/configured on <network>"** state and disables every action. It
  never falls back to the other network's address.

### Deploying the front end against Base Sepolia (optional)

Only if you have Base Sepolia test ETH: deploy the same `ConnectFour` there
(Remix with MetaMask set to Base Sepolia `84532`, or
`forge script script/Deploy.s.sol --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --private-key "$PRIVATE_KEY"`),
then fill `VITE_BASE_SEPOLIA_GAME_ADDRESS` with that address. **Never reuse the Ethereum
Sepolia address on Base Sepolia** (or vice-versa). This path is documented only —
we have not deployed to or verified Base Sepolia.

---

## Getting Sepolia test ETH & connecting MetaMask

1. Install MetaMask and create/select an account.
2. Add/switch to **Sepolia**: in MetaMask, enable *Show test networks* in
   Settings → Advanced, then pick **Sepolia** from the network selector. You can
   also use the app's **Switch wallet to Sepolia** button if it detects the wrong
   network.
3. Get free Sepolia ETH from a faucet (e.g. https://www.alchemy.com/faucets/ethereum-sepolia
   or https://sepoliafaucet.com). Newer accounts may need a small mainnet balance
   or a linked social login for some faucets.
4. Connect MetaMask to the app with **Connect MetaMask**.

---

## How to play

1. **Player 1** clicks **Create a new game** and confirms the transaction. The
   new game's id appears (equal to the contract's `gameCount`).
2. Share the game id. The app is **stateless** — anyone can reopen game `#id`
   from any device using **Open game**; all state comes from the chain.
3. **Player 2** opens the game id and clicks **Join this game as player 2**.
4. Players alternate dropping discs (click a ▼ above a column). Only the player
   whose turn it is can move, and only into a legal column.
5. The contract detects a win (four in a row) or a draw and stores the terminal
   status. Moves after the game ends are rejected.
6. **Timeout forfeit:** if the player on turn stalls for more than the fixed
   `MOVE_TIMEOUT` (**2 minutes**) after the last move, the **other** player can
   click **Claim win (opponent timed out)**. The button only enables after the
   on-chain deadline; an early claim, a claim by the active player, or a claim by
   a non-player all revert.
7. Reopen the app any time: the board, whose turn it is, and the result are
   rebuilt from `getGame` / `getBoard`, and the page keeps polling + watching the
   `MoveMade` / `GameJoined` events, so it updates as the other player moves.

---

## Transactions, confirmations, and RPC rate limits

- **One MetaMask confirmation per action.** `createGame`, `joinGame`, `move` and
  `claimTimeoutWin` are ordinary on-chain transactions, so each one requires a
  MetaMask confirmation. A turn is `move`; a full game is therefore N
  confirmations (one per disc). This is inherent to a design where the chain is
  the referee and there is **no relayer or off-chain authority** — removing the
  confirmations would require a backend/session-key/account-abstraction layer
  that could submit moves on a player's behalf, which the rubric's trust model
  does not allow. Per-move confirmation is kept deliberately.
- **Timeout window.** `MOVE_TIMEOUT` is **2 minutes** (operator directive). This
  replaces the original 1-day window so a stalled game cannot sit unresolved for a
  day; note the trade-off: the original problem statement's "play a game over a
  day, closing the app between moves" becomes "move within two minutes of your
  opponent". The on-chain rule and the UI countdown both use the 2-minute value.
- **429 / rate limits.** The app defaults to a public Sepolia RPC, which
  rate-limits bursts. The front end therefore keeps its request rate low (reads
  and event watchers share a 15-second cadence) and lets viem retry 429/timeout
  responses with backoff. If the endpoint still rate-limits, the app shows a
  clear "rate-limiting (429)" message telling you to wait a few seconds or set a
  private RPC URL via `VITE_SEPOLIA_RPC_URL` in `frontend/.env`.

---

## Contract design (how the rules are enforced)

- **Many games:** `mapping(uint256 => Game) games` keyed by `gameCount`.
- **Turns:** `move` requires `msg.sender == currentTurn`; the turn is derived
  from stored state, never from a caller-supplied address.
- **Legal moves:** `column < 7`, and the column must not be full
  (`_lowestEmptyRow`); both are checked in the contract.
- **Winner:** `_isWinningMove` scans the **stored board** in four directions from
  the last disc — no caller input is trusted.
- **Terminal status:** `status = Finished` on win/draw/timeout; `move` reverts
  unless `status == InProgress`.
- **Timeout:** `claimTimeoutWin` requires the caller to be a player who is **not**
  on turn and `block.timestamp > lastMoveTime + MOVE_TIMEOUT` (2 minutes).
- **Draw:** when `moveCount == 42` with no winner, the game finishes as a draw.
- **Events:** `MoveMade(uint256 indexed gameId, address indexed player, uint8
  column, uint8 row, uint8 playerId)` and friends.
- **No chain assumptions:** the contract never reads `block.chainid`, so the
  identical bytecode behaves the same on Ethereum Sepolia and Base Sepolia.

---

## Test coverage (Foundry — `forge test`)

| Scored check | Test(s) |
|---|---|
| Move rejects off-turn caller | `testMoveWrongTurnReverts`, `testMoveByStrangerReverts`, `testFuzz_OnlyCurrentTurnCanMove` |
| Move rejects illegal placement (range/full) | `testMoveOutOfRangeReverts`, `testMoveFullColumnReverts`, `testFuzz_MoveOutOfRangeAlwaysReverts` |
| Winner set by contract board check | `testHorizontalWin`, `testVerticalWin`, `testDiagonalWin`, `testPlayer2Wins` |
| No move after game ended | `testMoveAfterFinishReverts` |
| Timeout forfeit after deadline | `testTimeoutClaimSucceedsAfterDeadline`, `testTimeoutClaimTooEarlyReverts`, `testTimeoutCannotBeClaimedByActivePlayer`, `testTimeoutCannotBeClaimedByStranger`, `testTimeoutClockAdvancesWithMoves`, `testFuzz_TimeUntilTimeoutMatchesClaim` |
| Timeout window is the 2-minute directive | `testMoveTimeoutIsTwoMinutes` |
| Timeout view matches the claim boundary | `testTimeUntilTimeoutMatchesClaimBoundary` |
| Many games at once | `testManyGamesRunConcurrently`, `testManyIsolatedGamesStress` |
| Per-game timeout deadlines are independent | `testTimeoutDeadlinesAreIndependentAcrossGames` |
| Move event with indexed game id | `testMoveEventCarriesIndexedGameId` |
| Draw when no legal move remains | `testDrawWhenBoardFull` |

Result: **27 contract tests passing** (`forge test`), including 3 bounded fuzz
tests. The deterministic stress tests (`testManyIsolatedGamesStress` opens 20
games; `testTimeoutDeadlinesAreIndependentAcrossGames` advances time across two
games) exercise many games and timeout boundaries without any live network. The
front end has a separate `node:test` suite (**7 tests**, `npm test`) covering the
dual-network config, per-chain address selection, missing-address behaviour and
wrong-network guards.

---

## Security notes

- No private keys, mnemonics, or API keys are committed. Only `.env.example`
  placeholders are tracked; real values live in git-ignored `.env` files.
- The contract has no owner/admin and no upgrade path; the only write paths are
  the player actions described above.
