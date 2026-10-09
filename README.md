# Turn by Turn — Onchain Connect Four

A two-player, turn-based Connect Four where **the chain is the referee**. Two
people open/join a game, move whenever they have a minute, close the app between
moves, and the contract alone decides the winner, draws and timeout forfeits.
Many games run at once, and the frontend rebuilds its view entirely from chain
data whenever it is reopened.

> **Network:** Ethereum Sepolia, chain id **11155111**.
> (This project is configured for Ethereum Sepolia only. It does not target Base
> or any other network.)

---

## Repository layout

```
.
├── src/ConnectFour.sol        The game contract (Solidity 0.8.24)
├── test/ConnectFour.t.sol     Foundry tests covering all scored checks
├── script/Deploy.s.sol        Deployment script (Ethereum Sepolia)
├── foundry.toml               Foundry config
├── .env.example               Root env placeholders (RPC + key)
├── frontend/                  React + Vite + wagmi + viem app
│   ├── src/wagmi.ts           Chain config (Ethereum Sepolia) + contract address
│   ├── src/abi.ts             Contract ABI
│   ├── src/hooks/useGame.ts   Reads game + board from chain, live-updates
│   ├── src/components/Board.tsx
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

## 2. Contract: deploy to Ethereum Sepolia

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
`frontend/.env` as `VITE_GAME_ADDRESS`.

> `.env` is git-ignored. Only `.env.example` (placeholders) is tracked. Never
> commit a private key, mnemonic, API key, or a key-bearing RPC URL.

### Deployment status

No deployment has been recorded in this repo yet (no funded Sepolia key was
available at build time). Complete the command above and paste the resulting
address into `frontend/.env` and here:

```
ConnectFour (Ethereum Sepolia): <not deployed yet>
```

---

## 3. Frontend: install & run

```bash
cd frontend
npm install
cp .env.example .env
# .env:
#   VITE_GAME_ADDRESS=0x<your deployed contract>
#   VITE_SEPOLIA_RPC_URL=        (optional; public default used if empty)

npm run dev        # http://localhost:5173
npm run build      # type-check + production build
```

---

## Getting Sepolia test ETH & connecting MetaMask

1. Install MetaMask and create/select an account.
2. Add/switch to **Sepolia**: in MetaMask, enable *Show test networks* in
   Settings → Advanced, then pick **Sepolia** from the network selector. You can
   also click the app's **Switch to Sepolia** button if the app detects the wrong
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
   `MOVE_TIMEOUT` (1 day) after the last move, the **other** player can click
   **Claim win (opponent timed out)**. The button only enables after the on-chain
   deadline; an early claim, a claim by the active player, or a claim by a
   non-player all revert.
7. Reopen the app any time: the board, whose turn it is, and the result are
   rebuilt from `getGame` / `getBoard`, and the page keeps polling + subscribing to
   events, so it updates as the other player moves.

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
  on turn and `block.timestamp > lastMoveTime + MOVE_TIMEOUT` (1 day).
- **Draw:** when `moveCount == 42` with no winner, the game finishes as a draw.
- **Events:** `MoveMade(uint256 indexed gameId, address indexed player, uint8
  column, uint8 row, uint8 playerId)` and friends.

---

## Test coverage (Foundry — `forge test`)

| Scored check | Test(s) |
|---|---|
| Move rejects off-turn caller | `testMoveWrongTurnReverts`, `testMoveByStrangerReverts` |
| Move rejects illegal placement (range/full) | `testMoveOutOfRangeReverts`, `testMoveFullColumnReverts` |
| Winner set by contract board check | `testHorizontalWin`, `testVerticalWin`, `testDiagonalWin`, `testPlayer2Wins` |
| No move after game ended | `testMoveAfterFinishReverts` |
| Timeout forfeit after deadline | `testTimeoutClaimSucceedsAfterDeadline`, `testTimeoutClaimTooEarlyReverts`, `testTimeoutCannotBeClaimedByActivePlayer`, `testTimeoutCannotBeClaimedByStranger`, `testTimeoutClockAdvancesWithMoves` |
| Many games at once | `testManyGamesRunConcurrently` |
| Move event with indexed game id | `testMoveEventCarriesIndexedGameId` |
| Draw when no legal move remains | `testDrawWhenBoardFull` |

Result: **20 tests passing** (`forge test`).

---

## Security notes

- No private keys, mnemonics, or API keys are committed. Only `.env.example`
  placeholders are tracked; real values live in git-ignored `.env` files.
- The contract has no owner/admin and no upgrade path; the only write paths are
  the player actions described above.
