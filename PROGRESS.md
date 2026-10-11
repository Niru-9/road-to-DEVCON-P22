# PROGRESS — Turn by Turn (`turn-by-turn`)

Project folder: `N:\dev7\tbyt` (only this folder; never `dev7`, `pt`, or `sg`).

## Current session

- **Start:** 2026-10-10 (session 2 — resume/verify)
- **Task:** Resume the MVP, verify the previous session's claims against the
  actual source, and continue from the next real unfinished item (Sepolia
  deployment + optional GitHub push).
- **Plan items:** `plan.md` §4 checklist (all 10 scored checks), §5 tasks, §6.
- **Observed state at start:** full source tree present (contract, 20 tests,
  frontend, deploy script, docs). Working tree clean on a single local commit,
  no git remote. No `.env` files and neither `SEPOLIA_RPC_URL` nor `PRIVATE_KEY`
  set in the environment, so Sepolia deployment credentials are still absent.
- **Operator directive (unchanged):** target **Ethereum Sepolia (`11155111`)** +
  MetaMask, NOT Base Sepolia. This is a known deviation from the rubric's
  Base Sepolia wording and is recorded in `plan.md` §2/§7 and `README.md`.

## Status board

- [x] Scored check 1 — frontend targets Ethereum Sepolia (wagmi `sepolia`)
- [x] Scored check 2 — no credential tracked (scan clean)
- [x] Scored check 3 — move rejects off-turn caller
- [x] Scored check 4 — move rejects illegal placement
- [x] Scored check 5 — winner set by contract board check
- [x] Scored check 6 — no move after game end
- [x] Scored check 7 — timeout forfeit after deadline
- [x] Scored check 8 — many games at once
- [x] Scored check 9 — move event with indexed game id
- [x] Scored check 10 — draw when no legal move remains
- [ ] Sepolia deployment recorded (BLOCKED — credentials unavailable)

## What changed this session (session 2)

- No application code was changed; the previous session's implementation was
  re-read and re-verified.
- Re-ran the full Foundry suite and the frontend production build (both pass —
  see results below).
- Ran an independent credential scan over the tracked source; clean.
- **Smoke-tested `script/Deploy.s.sol` against a local anvil node** (chain 31337)
  using the public, well-known anvil dev key (not a secret). The script
  compiled, broadcast, and deployed `ConnectFour` successfully. This confirms
  the deploy path actually works — only the Sepolia RPC/key are missing.
- Removed the local smoke-test `broadcast/` artifacts to leave the tree clean
  (`git status` clean again). No `.gitignore` change needed; real deployments are
  still trackable, local dry-runs were already ignored.

## Checks actually run and results (session 2)

- `forge test` → **20 passed; 0 failed; 0 skipped** (6.46 ms), solc 0.8.24.
- `forge build` (implicit in `forge test`, plus deploy-script compile) → OK.
- `npm run build` (frontend) → **successful** (`tsc -b` + `vite build`, 4734
  modules, 391.31 kB main bundle). Output includes non-fatal Rollup warnings
  about `/*#__PURE__*/` comment placement inside `node_modules`; they do not
  affect the build.
- Credential scan (`git ls-files` minus `lib/`, `node_modules`, lockfile; grep
  for `0x`+64-hex and `mnemonic|seed phrase|private[_-]?key`) → no real secret;
  only `.env.example`/`README.md`/`PROGRESS.md`/`plan.md`/`Deploy.s.sol`
  placeholders and documentation.
- `forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8546 --broadcast`
  against a local anvil node → **ONCHAIN EXECUTION COMPLETE & SUCCESSFUL**;
  `ConnectFour deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3`
  (local test chain only — not a Sepolia deployment).
- `forge --version` → 1.8.1 (preinstalled at
  `C:\Users\NIRUPAM\.foundry\bin\forge.exe`; no install/download needed).

## Unfinished / blockers

- **Deployment: BLOCKED.** No Sepolia RPC URL and no funded throwaway private
  key are available. Nothing has been deployed to Sepolia. There is no
  deployed contract address to record.
- **Push to GitHub:** not done — no remote configured, no repo provided, and no
  push was requested.
- Rubric check #1 text mentions Base Sepolia; the operator explicitly directed
  Ethereum Sepolia. The project follows the operator; flagged for the reviewer.

## Exact next step (next session)

1. Obtain a Sepolia JSON-RPC URL and a throwaway test account funded with
   Sepolia ETH. Keep both only in a git-ignored local `.env`; never paste a
   private key or seed phrase into chat or a tracked file.
2. Deploy:
   `forge script script/Deploy.s.sol --rpc-url $env:SEPOLIA_RPC_URL --broadcast --private-key $env:PRIVATE_KEY`
3. Record the printed address in `frontend/.env`
   (`VITE_SEPOLIA_GAME_ADDRESS`) and in `README.md` ("Deployment status").
4. Re-run `forge test` and `npm run build`; optionally smoke-test a game on
   Sepolia with MetaMask.
5. Only if the user provides/selects a repo and explicitly asks: configure a
   remote and push.

## Session log

### 2026-10-10 — session 1

- Full implementation completed and locally verified. Only on-chain deployment +
  GitHub push remain, both blocked on credentials.

### 2026-10-10 — session 2 (resume/verify)

- Re-verified all local claims: `forge test` 20/20 pass, `npm run build`
  succeeds, credential scan clean.
- Confirmed no deployment credentials are configured; deployment remains
  BLOCKED.
- New: smoke-tested `script/Deploy.s.sol` on a local anvil node — deploy path
  works end-to-end; only Sepolia RPC/key are missing.
- No source changes; working tree clean. Nothing deployed to Sepolia.
- **Session end:** 2026-10-10

## Overall MVP status: IN PROGRESS (deployment BLOCKED)

All ten scored checks are implemented and pass locally. The contract is **not**
deployed to Sepolia (no credentials). Per the rule that the MVP cannot be marked
complete while deployment is unfinished, the overall status stays `IN PROGRESS`;
deployment is `BLOCKED` and cannot move to `DONE (verified)` until a Sepolia
address is recorded.

## Fresh verification — session 3 (2026-10-10, live re-run)

Everything re-run from scratch in `N:\dev7\tbyt` (prior reports not reused as
evidence):
- `forge test` → **20 passed; 0 failed; 0 skipped** (exit 0).
- `npm run build` (frontend, `tsc -b && vite build`) → **success** (exit 0).
- Credential scan of tracked files → **clean** (only `.env.example` placeholders).

Rubric results (source-verified this session):
- Checks 3–10: PASS — backed by `src/ConnectFour.sol` (`move` turn/range/full
  guards, `_isWinningMove` over stored board, `Status.Finished` guard,
  `claimTimeoutWin`, `mapping(uint256 => Game)`, indexed `MoveMade`, 42-cell
  draw) and the 20 Foundry tests.
- Check 2: PASS — no credential in any tracked file.
- Check 1: FAIL as written (rubric wants Base Sepolia 84532); the frontend is
  intentionally configured for **Ethereum Sepolia 11155111** per operator
  directive (`frontend/src/wagmi.ts`). Operator network requirement met.

Remaining gap: not deployed to Sepolia (README still shows `<not deployed yet>`);
no remote/push. No source changes this session.

## Pre-deployment review — session 4 (2026-10-11)

Reviewed the whole project (contract, tests, deploy script, frontend
`abi.ts`/`wagmi.ts`/`hooks`) against `p1.md` before deployment.

- **Fixed (Medium) — `src/ConnectFour.sol` `timeUntilTimeout`.** The view returned
  `0` at exactly `lastMoveTime + MOVE_TIMEOUT`, but `claimTimeoutWin` requires
  `block.timestamp > lastMoveTime + MOVE_TIMEOUT`. `App.tsx` enables the claim
  button when `timeoutSeconds == 0`, so a user following the UI could submit a claim
  in that 1-second window that reverts (wasted gas). The view now returns `1` at the
  exact deadline and `0` only once a claim would succeed. `claimTimeoutWin`, the
  game rules, storage layout and events are unchanged.
- Focused regression test added: `testTimeUntilTimeoutMatchesClaimBoundary`
  (view == 1 and claim reverts at the deadline; view == 0 and claim succeeds one
  second later, awarding the win to the non-active player).
- No other Critical/High/Medium correctness or security issues found. No external
  calls; no unbounded loops; games live in a `mapping`, so game count never affects
  any loop.

Checks actually run (2026-10-11):
- `forge test` → **21 passed; 0 failed; 0 skipped** (exit 0), solc 0.8.24
  (20 baseline + 1 new regression test).
- `forge build` → exit 0.
- Credential scan of tracked files → clean (`.env.example` placeholders only).

Frontend assumptions: the fix does not change the view signature, struct order,
events, or any other ABI surface, so `frontend/src/abi.ts` and `wagmi.ts`
(Ethereum Sepolia 11155111) still match. No frontend change required.

Rubric after the change (source-verified): checks 2–10 PASS; check 1 remains the
documented operator-directed deviation (Ethereum Sepolia 11155111, not Base Sepolia
84532).

Remaining risks / not done: still not deployed to Sepolia (no credentials); no
remote/push; `forge fmt --check` shows cosmetic style diffs (not enforced, no CI).
Ready for the next deployment step: **yes**, once an RPC URL and a funded throwaway
key are supplied.

## Pre-deployment stress + fuzz hardening — session 5 (2026-10-11)

Work in `N:\dev7\tbyt` only. No deployment, no wallet keys, no GitHub push; target
remains Ethereum Sepolia 11155111.

- **Tests 21 → 26** (`test/ConnectFour.t.sol`). Added bounded Foundry stress and
  fuzz tests:
  - `testManyIsolatedGamesStress` — 20 concurrent games played to completion;
    asserts each game's board/turn/status is independent (covers check 8 under
    load).
  - `testTimeoutDeadlinesAreIndependentAcrossGames` — each game's timeout is
    measured from its own `lastMoveTime`; advancing time affects only the expired
    game.
  - `testFuzz_TimeUntilTimeoutMatchesClaim` — fuzzed warp; `timeUntilTimeout` and
    the `claimTimeoutWin` boundary always agree (regression-locks the session-4
    fix).
  - `testFuzz_MoveOutOfRangeAlwaysReverts` — any column >= `COLS` reverts.
  - `testFuzz_OnlyCurrentTurnCanMove` — only the on-turn caller is accepted.
- **`forge fmt` applied** to the project so `forge fmt --check` passes (cosmetic
  only; supersedes the session-4 note that fmt diffs were left in place).
- **README updated**: added a Remix + MetaMask deploy section (contract source,
  contract name, solc 0.8.24, Sepolia 11155111 via injected MetaMask); the test
  table now lists 26 tests including the new stress/fuzz rows. The Remix procedure
  is documented but **not** claimed as executed.

### Checks actually run (2026-10-11, session 5, live re-run)
- `forge test` → **26 passed; 0 failed; 0 skipped** (exit 0), solc 0.8.24.
- `forge build` → exit 0; `forge fmt --check` → exit 0.
- `npm run build` (frontend, `tsc -b && vite build`) → success (exit 0); only
  non-fatal Rollup `/*#__PURE__*/` node_modules warnings.
- Credential scan of tracked files → clean (`.env.example` placeholders only).

### Rubric after the change
Checks 2–10 PASS; check 1 remains the documented operator-directed deviation
(Ethereum Sepolia 11155111, not Base Sepolia 84532).

### Still not done (session 5)
Still not deployed to Sepolia (no RPC/key); no GitHub push; no git commit since
`2e37d1c` (changes uncommitted). Ready for the deployment step once credentials are
supplied.

## Dual-network support — session 6 (2026-10-11)

Work in `N:\dev7\tbyt` only. No deployment, no wallet keys, no push.

- Added dual-network support so the same front end can run against **Ethereum
  Sepolia (11155111, our target)** or **Base Sepolia (84532, configurable, not
  deployed/verified)** with the identical contract source.
- **New:** `frontend/src/chains.ts` (pure registry + resolvers + guards),
  `frontend/src/useSelectedChain.ts` (persisted selection),
  `frontend/test/chains.test.ts` (7 `node:test` tests).
- **Changed:** `frontend/src/wagmi.ts` (both chains + per-chain transports +
  `contractAddressFor`), `hooks/useGame.ts` and `App.tsx` (reads/events/writes
  pinned to the selected chain; wrong-network banner + blocked writes;
  not-configured state), `frontend/.env.example` + root `.env.example`
  (per-chain vars), `frontend/package.json` (`npm test`), `styles.css`,
  `README.md`.
- Env vars renamed per chain: `VITE_SEPOLIA_GAME_ADDRESS` /
  `VITE_BASE_SEPOLIA_GAME_ADDRESS` and `VITE_SEPOLIA_RPC_URL` /
  `VITE_BASE_SEPOLIA_RPC_URL`; root `.env.example` adds optional
  `BASE_SEPOLIA_RPC_URL`.
- Contract + deploy script reviewed: no `block.chainid` use, no chain-specific
  assumption; behaviour and interfaces unchanged (still 26 Foundry tests).

### Live re-run (session 6)
- `forge test` → **26 passed; 0 failed; 0 skipped** (exit 0).
- `forge fmt --check` → exit 0.
- `npm test` (frontend) → **7 passed; 0 failed**.
- `npm run build` (frontend) → success (exit 0); non-fatal Rollup warnings only.
- Credential scan of tracked files → clean.

### Not done / unchanged (session 6)
- No Sepolia or Base Sepolia deployment; Base Sepolia is **configured only**,
  never deployed or verified. No GitHub push. Changes uncommitted.

## Manual-test hardening — session 7 (2026-10-11)

Work in `N:\dev7\tbyt` only. No deployment, no wallet keys, no GitHub push; target
remains Ethereum Sepolia 11155111.

### Findings addressed
1. **"429 / rate-limit errors when joining."** Public Sepolia RPC
   (`ethereum-sepolia-rpc.publicnode.com`) rate-limited the app's read burst plus
   the join write.
2. **"24-hour move timeout."** Reduced the per-move timeout to **2 minutes**.
3. **"Per-move MetaMask confirmations."** Assessed; kept by design (see below).

### Changes
- **`src/ConnectFour.sol`** — `MOVE_TIMEOUT` lowered from `24 hours` to
  `2 minutes`. Every read of it (`claimTimeoutWin`, `timeUntilTimeout`) follows the
  constant; no other logic changed, storage layout and events unchanged.
- **`test/ConnectFour.t.sol`** — new `testMoveTimeoutIsTwoMinutes` locks the value
  (26 → **27 tests**).
- **`frontend/src/wagmi.ts`** — per-chain transport now sets `retryCount: 6`,
  `retryDelay: 750`, `timeout: 20_000` so a transient 429/timeout is retried
  instead of surfacing as a failed join/move.
- **`frontend/src/hooks/useGame.ts`** — one shared **15 s** cadence for the three
  periodic reads and the watchers; watchers cut **4 → 2** (`MoveMade`, `GameJoined`).
  This drops the read request rate well under public-RPC limits; `GameFinished`
  rides on `MoveMade`, and a rare timeout claim is caught by the slow poll.
- **`frontend/src/App.tsx`** — added `friendlyError()`, a 429/rate-limit-aware
  message for both read and write errors that points the user at
  `VITE_SEPOLIA_RPC_URL` for a private endpoint.

### Per-move confirmations — assessed, kept
Each move is a real on-chain write signed by the player's own wallet, so each move
requires a wallet confirmation. There is **no relayer, server, or off-chain
authority** in this design — introducing one to batch/skip confirmations would
break the rubric's trust model (the contract is the referee; the mover must
authorize the move). Kept deliberately; documented rather than removed.

### Trade-off recorded (acceptance criterion vs rubric)
The problem statement's acceptance note ("play a full game over a day, closing the
app between moves") conflicts with a 2-minute timeout. Implemented as directed
(shorter games, faster completion); the tension is documented in `README.md` and
`plan.md`. Play resumes across reloads because game state lives on-chain.

### Checks actually run (2026-10-11, session 7, live re-run)
- `forge test` → **27 passed; 0 failed; 0 skipped** (exit 0), solc 0.8.24.
- `forge fmt --check` → exit 0.
- `npm test` (frontend) → **7 passed; 0 failed**.
- `npm run build` (frontend) → success (exit 0); only non-fatal Rollup
  `/*#__PURE__*/` node_modules warnings.
- **Not verified:** no live Sepolia run; the actual 429 reduction and the 2-minute
  timeout must be confirmed manually after deploy.

### Remaining risks
- The real 429 rate depends on the public endpoint; a private RPC is the robust
  fix and is now surfaced in the error text.
- `MOVE_TIMEOUT = 2 minutes` means an idle game can be forfeited quickly — intended,
  and surfaced by `timeUntilTimeout`.

### Still not done
- No deployment (no RPC/key supplied); no GitHub push; changes uncommitted.
  Base Sepolia remains configured-only (not deployed/verified).
