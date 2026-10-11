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

The operator directs **Ethereum Sepolia, chain ID `11155111`**, tested with
desktop MetaMask, as the **deployment + manual-verification target**. This
overrides the generic "Base Sepolia" line in the shared brief.

Since session 6 the front end is **dual-network**: it also recognises **Base
Sepolia (`84532`)** as a *configurable* network, each with its own address/RPC
that is never shared. Base Sepolia is **not** deployed to or verified (no Base
Sepolia test ETH was available). The same contract source deploys unchanged to
either chain (it never reads `block.chainid`). The rubric's check #1 mentions
Base Sepolia; that stays recorded in Risks as a deviation, now softened — Base
Sepolia is *supported/configured* but not demonstrated.

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
    .env.example             Per-chain address/RPC placeholders
    src/main.tsx
    src/App.tsx              Wallet + network selector + lobby/board
    src/chains.ts            Dual-network registry (per-chain address/RPC)
    src/useSelectedChain.ts  Persisted network selection
    src/wagmi.ts             wagmi config for both chains + address resolver
    src/abi.ts               Contract ABI
    src/hooks/useGame.ts     Reads game + board from the selected chain
    src/components/Board.tsx  7x6 board render + column-drop buttons
    test/chains.test.ts      node:test dual-network config tests
```

**Contract design**

- `struct Game { player1, player2, currentTurn, winner, Status status,
  uint64 lastMoveTime, uint16 moveCount, uint8[42] board }`, stored in
  `mapping(uint256 => Game) games`; `uint256 gameCount`.
- `Status { WaitingForOpponent, InProgress, Finished }`.
- `uint256 constant MOVE_TIMEOUT = 2 minutes` (fixed; measured from `lastMoveTime`).
  Operator directive (2026-10-11): shortened from `1 days` so a stalled game is
  forfeitable within minutes. Trade-off vs the original "play over a day" wording
  is recorded in `README.md` and `PROGRESS.md`.
- `board` index = `row * COLS + column`, row 0 = bottom, `0` empty, `1` p1, `2` p2.

## 4. Requirement-to-implementation checklist (all 10 scored checks)

| # | Scored check | Where implemented | Status |
|---|--------------|-------------------|--------|
| 1 | Frontend targets Ethereum Sepolia (operator override); optionally Base Sepolia | `frontend/src/chains.ts`, `frontend/src/wagmi.ts` | DONE |
| 2 | No credential in any tracked file | `.gitignore`, `.env.example`, no keys | DONE (verified) |
| 3 | Move rejects caller not on turn | `ConnectFour.move` `require(msg.sender == currentTurn)` | DONE (verified) |
| 4 | Move rejects illegal placement (range/full) | `ConnectFour.move` `column < COLS`, `_lowestEmptyRow` full check | DONE (verified) |
| 5 | Winner set by contract board check | `ConnectFour._isWinningMove` over stored `board` | DONE (verified) |
| 6 | No move accepted after game ended | `ConnectFour.move` `require(status == InProgress)` | DONE (verified) |
| 7 | Stalled game forfeitable after deadline | `ConnectFour.claimTimeoutWin` (non-active player, `> lastMoveTime + MOVE_TIMEOUT`) | DONE (verified) |
| 8 | Many games run at once | `mapping(uint256 => Game)` + `gameCount` | DONE (verified) |
| 9 | Each move emits event identifying game | `event MoveMade(uint256 indexed gameId, ...)` | DONE (verified) |
| 10 | Game ends when no legal move remains (draw) | `ConnectFour.move` `moveCount == 42` → Finished | DONE (verified) |

Deployment to Sepolia: **NOT DONE (BLOCKED)** — no funded key/RPC available;
documented in README. `script/Deploy.s.sol` was smoke-tested against a local
anvil node (chain 31337) and deploys successfully, so only the Sepolia RPC/key
are missing.

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

## 8. Fresh verification (2026-10-10, session 3)

- `forge test` → 20/20 pass (exit 0); `npm run build` → success (exit 0);
  tracked-file credential scan clean.
- Checks 3–10 and 2 re-confirmed against source + tests. Check 1 remains a
  deliberate operator-directed deviation from the rubric's Base Sepolia wording
  (frontend targets Ethereum Sepolia 11155111).
- Remaining gap: no Sepolia deployment recorded yet; no remote/push.

## 9. Pre-deployment correctness review (2026-10-11, session 4)

- Re-inspected the contract, tests, deploy script, and frontend ABI/config against
  `p1.md`. No Critical/High issues found: access control, turn/range/full-column
  guards, win detection over the stored board, terminal guards, timeout forfeit,
  concurrent games (`mapping`), indexed move event, and draw detection all
  re-confirmed. No external calls (no reentrancy surface) and no unbounded loops.
- **Fixed (Medium):** `ConnectFour.timeUntilTimeout` returned `0` at exactly
  `lastMoveTime + MOVE_TIMEOUT`, but `claimTimeoutWin` requires strictly
  `block.timestamp > lastMoveTime + MOVE_TIMEOUT`. `App.tsx` enables the claim
  button when the view is `0`, so a UI-driven claim in that window reverts (wasted
  gas). The view now returns `1` at the exact deadline and `0` only once a claim
  would succeed; the claim condition, game rules, storage layout and events are
  unchanged. Regression test `testTimeUntilTimeoutMatchesClaimBoundary` added.
- Remaining (unchanged): frontend + docs target **Ethereum Sepolia 11155111** per
  operator directive; rubric check 1 (Base Sepolia 84532) stays a documented
  deviation. Deployment still BLOCKED (no RPC/key).
- ~~`forge fmt --check` shows cosmetic style diffs (event parameter layout); no CI
  in this project enforces it, so left unchanged to keep the diff focused.~~
  **Superseded in session 5:** `forge fmt` applied so `forge fmt --check` passes.
- Verification: `forge test` → 21/21 pass (20 baseline + new regression test),
  `forge build` → exit 0, tracked-file credential scan clean.

## 10. Pre-deployment stress + fuzz hardening (2026-10-11, session 5)

- **Tests 21 → 26.** Added bounded Foundry stress + fuzz tests to
  `test/ConnectFour.t.sol`:
  - `testManyIsolatedGamesStress` — 20 concurrent games created/played to
    completion, asserting per-game isolation of board and turn state.
  - `testTimeoutDeadlinesAreIndependentAcrossGames` — timeouts are measured from
    each game's own `lastMoveTime`; advancing time past one game's deadline does
    not affect another's.
  - `testFuzz_TimeUntilTimeoutMatchesClaim` — fuzzed `warp` amount; the view and
    the `claimTimeoutWin` boundary always agree.
  - `testFuzz_MoveOutOfRangeAlwaysReverts` — fuzzed column >= COLS always reverts.
  - `testFuzz_OnlyCurrentTurnCanMove` — fuzzed caller; only the on-turn player is
    accepted.
- **`forge fmt` applied** to tbyt (and pt, sg) so `forge fmt --check` passes; this
  is cosmetic only and all tests remain green.
- README updated: added a Remix + MetaMask deploy section; test table now lists 26
  tests including the new stress/fuzz rows.

### Verification (2026-10-11, session 5, live re-run)
- `forge test` → **26 passed; 0 failed; 0 skipped** (exit 0), solc 0.8.24.
- `forge build` → exit 0; `forge fmt --check` → exit 0.
- `npm run build` (frontend, `tsc -b && vite build`) → success (exit 0);
  non-fatal Rollup `/*#__PURE__*/` node_modules warnings only.
- Credential scan of tracked files → clean.
- Rubric: checks 2–10 PASS; check 1 stays the documented Ethereum-Sepolia
  (11155111) deviation. Deployment still BLOCKED (no RPC/key).

## 11. Dual-network compatibility (2026-10-11, session 6)

Goal: make the front end work on **either** Ethereum Sepolia (`11155111`, target)
**or** Base Sepolia (`84532`, configurable/not deployed) when the same contract is
separately deployed, with no chain-specific assumptions.

- **New `frontend/src/chains.ts`** (pure, dependency-free): both chain ids, per
  chain `rpcEnv`/`addressEnv`, `DEFAULT_CHAIN_ID = 11155111`, and resolvers
  `resolveAddress`/`hasAddress`/`resolveRpcUrl` that use the chain's own value and
  **never** fall back to another chain's address. Also `walletMatchesSelected` and
  `canTransact` guards.
- **New `frontend/src/useSelectedChain.ts`**: persisted (localStorage) selection,
  validated against the supported set.
- **`frontend/src/wagmi.ts`**: config lists both `sepolia` and `baseSepolia` with
  per-chain transports; exports `contractAddressFor(chainId)` /
  `hasContractAddress(chainId)`.
- **`useGame.ts` / `App.tsx`**: reads, live events and writes are pinned to the
  **selected** chain via wagmi's `chainId` parameter. A wrong-chain wallet shows a
  "switch" banner and **blocks writes**. A selected chain with no configured
  address shows a **"Not deployed/configured on <network>"** state and disables
  actions.
- **Env vars (renamed per chain):** `VITE_SEPOLIA_GAME_ADDRESS` /
  `VITE_BASE_SEPOLIA_GAME_ADDRESS` and `VITE_SEPOLIA_RPC_URL` /
  `VITE_BASE_SEPOLIA_RPC_URL`; root `.env.example` gains an optional
  `BASE_SEPOLIA_RPC_URL`.
- **Tests:** new `frontend/test/chains.test.ts` (7 tests) run with Node's built-in
  test runner + TS type-stripping (`npm test`): chain config, per-chain address
  selection, missing-address (no fallback), wrong-network protection. All 26
  Foundry tests unchanged.
- **Contract/scripts:** reviewed; neither `ConnectFour.sol` nor `Deploy.s.sol`
  reads `block.chainid`, so there is no chain-specific assumption and **no
  contract behaviour or interface changed**.

### Verification (session 6)
- `forge test` → 26/26 pass (exit 0); `forge fmt --check` → exit 0.
- `npm test` (frontend) → 7/7 pass; `npm run build` → exit 0.
- Base Sepolia is **configured/compatible only** — not deployed, not verified.
