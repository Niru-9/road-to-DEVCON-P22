// Minimal hand-written ABI for the ConnectFour contract.
export const connectFourAbi = [
  {
    type: "function",
    name: "createGame",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "gameId", type: "uint256" }],
  },
  {
    type: "function",
    name: "joinGame",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "move",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "column", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimTimeoutWin",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "gameCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "MOVE_TIMEOUT",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getGame",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "player1", type: "address" },
      { name: "player2", type: "address" },
      { name: "currentTurn", type: "address" },
      { name: "winner", type: "address" },
      { name: "status", type: "uint8" },
      { name: "lastMoveTime", type: "uint64" },
      { name: "moveCount", type: "uint16" },
    ],
  },
  {
    type: "function",
    name: "getBoard",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8[42]" }],
  },
  {
    type: "function",
    name: "timeUntilTimeout",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "GameCreated",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player1", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "GameJoined",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player1", type: "address", indexed: true },
      { name: "player2", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "MoveMade",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "column", type: "uint8", indexed: false },
      { name: "row", type: "uint8", indexed: false },
      { name: "playerId", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GameFinished",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TimeoutClaimed",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
    ],
  },
] as const;

// Game status enum, mirroring the contract.
export const Status = {
  WaitingForOpponent: 0,
  InProgress: 1,
  Finished: 2,
} as const;

export const Outcome = {
  None: 0,
  Player1Win: 1,
  Player2Win: 2,
  Draw: 3,
} as const;
