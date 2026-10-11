// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Turn by Turn — on-chain Connect Four referee
/// @notice Many asynchronous two-player games stored by id. The contract owns
///         turn order, legal-move rules, winner detection, draws and timeout
///         forfeits. There is no admin and no off-chain authority.
contract ConnectFour {
    uint8 public constant ROWS = 6;
    uint8 public constant COLS = 7;
    uint16 public constant CELLS = 42; // ROWS * COLS
    uint8 public constant EMPTY = 0;
    uint8 public constant PLAYER1 = 1;
    uint8 public constant PLAYER2 = 2;

    /// @dev Fixed window a player has to move before the opponent may claim a
    ///      timeout win. Measured from the stored last-move time. A stalled game
    ///      can therefore be forfeited within a couple of minutes instead of
    ///      being stuck for a day (the original value), so a shared game id does
    ///      not leave the opening player unable to force a result.
    uint256 public constant MOVE_TIMEOUT = 2 minutes;

    enum Status {
        WaitingForOpponent,
        InProgress,
        Finished
    }

    enum Outcome {
        None,
        Player1Win,
        Player2Win,
        Draw
    }

    struct Game {
        address player1;
        address player2;
        address currentTurn;
        address winner; // address(0) unless a player won
        Status status;
        uint64 lastMoveTime;
        uint16 moveCount;
        uint8[42] board; // 0 empty, 1 player1, 2 player2; index = row*COLS + col
    }

    uint256 public gameCount;
    mapping(uint256 => Game) private games;

    event GameCreated(uint256 indexed gameId, address indexed player1);
    event GameJoined(uint256 indexed gameId, address indexed player1, address indexed player2);
    event MoveMade(
        uint256 indexed gameId, address indexed player, uint8 column, uint8 row, uint8 playerId
    );
    event GameFinished(uint256 indexed gameId, address indexed winner, Outcome outcome);
    event TimeoutClaimed(uint256 indexed gameId, address indexed winner);

    modifier gameExists(uint256 gameId) {
        require(gameId >= 1 && gameId <= gameCount, "NO_GAME");
        _;
    }

    /// @notice Open a new game. Caller becomes player 1; a second player must join.
    /// @return gameId the id of the new game.
    function createGame() external returns (uint256 gameId) {
        gameId = ++gameCount;
        Game storage g = games[gameId];
        g.player1 = msg.sender;
        g.status = Status.WaitingForOpponent;
        g.lastMoveTime = uint64(block.timestamp);
        emit GameCreated(gameId, msg.sender);
    }

    /// @notice Join an open game as player 2. Player 1 moves first.
    function joinGame(uint256 gameId) external gameExists(gameId) {
        Game storage g = games[gameId];
        require(g.status == Status.WaitingForOpponent, "NOT_OPEN");
        require(msg.sender != g.player1, "SELF_JOIN");
        g.player2 = msg.sender;
        g.currentTurn = g.player1;
        g.status = Status.InProgress;
        g.lastMoveTime = uint64(block.timestamp);
        emit GameJoined(gameId, g.player1, msg.sender);
    }

    /// @notice Drop a disc into a column. Only the player whose turn it is may
    ///         call, and only while the game is in progress.
    /// @param gameId the game to move in.
    /// @param column target column (0 .. COLS-1).
    function move(uint256 gameId, uint8 column) external gameExists(gameId) {
        Game storage g = games[gameId];
        require(g.status == Status.InProgress, "NOT_ACTIVE");
        require(msg.sender == g.currentTurn, "NOT_YOUR_TURN");
        require(column < COLS, "COL_OUT_OF_RANGE");

        uint8 pid = msg.sender == g.player1 ? PLAYER1 : PLAYER2;

        (uint8 row, bool placed) = _lowestEmptyRow(g, column);
        require(placed, "COLUMN_FULL");

        g.board[_index(row, column)] = pid;
        g.moveCount += 1;
        g.lastMoveTime = uint64(block.timestamp);

        emit MoveMade(gameId, msg.sender, column, row, pid);

        if (_isWinningMove(g, row, column, pid)) {
            g.winner = msg.sender;
            g.status = Status.Finished;
            emit GameFinished(
                gameId, msg.sender, pid == PLAYER1 ? Outcome.Player1Win : Outcome.Player2Win
            );
        } else if (g.moveCount == CELLS) {
            g.status = Status.Finished;
            emit GameFinished(gameId, address(0), Outcome.Draw);
        } else {
            g.currentTurn = msg.sender == g.player1 ? g.player2 : g.player1;
        }
    }

    /// @notice After the fixed timeout measured from the last move, the player who
    ///         is NOT on turn may end the game in their own favour. Reverts if the
    ///         caller is the stalling (active) player, is not a player, or is early.
    function claimTimeoutWin(uint256 gameId) external gameExists(gameId) {
        Game storage g = games[gameId];
        require(g.status == Status.InProgress, "NOT_ACTIVE");
        require(msg.sender == g.player1 || msg.sender == g.player2, "NOT_PLAYER");
        require(msg.sender != g.currentTurn, "YOU_ARE_ON_TURN");
        require(block.timestamp > uint256(g.lastMoveTime) + MOVE_TIMEOUT, "CLAIM_TOO_EARLY");

        g.winner = msg.sender;
        g.status = Status.Finished;
        uint8 pid = msg.sender == g.player1 ? PLAYER1 : PLAYER2;
        emit GameFinished(
            gameId, msg.sender, pid == PLAYER1 ? Outcome.Player1Win : Outcome.Player2Win
        );
        emit TimeoutClaimed(gameId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getGame(uint256 gameId)
        external
        view
        gameExists(gameId)
        returns (
            address player1,
            address player2,
            address currentTurn,
            address winner,
            Status status,
            uint64 lastMoveTime,
            uint16 moveCount
        )
    {
        Game storage g = games[gameId];
        return
            (g.player1, g.player2, g.currentTurn, g.winner, g.status, g.lastMoveTime, g.moveCount);
    }

    /// @notice Full board as a flat ROWS*COLS array (index = row*COLS + col).
    function getBoard(uint256 gameId) external view gameExists(gameId) returns (uint8[42] memory) {
        return games[gameId].board;
    }

    /// @notice Seconds until the current player can be forfeited (0 if already due
    ///         or the game is not in progress).
    /// @dev `claimTimeoutWin` requires `block.timestamp > lastMoveTime + MOVE_TIMEOUT`,
    ///      so at exactly the deadline a claim is still rejected. This view returns
    ///      0 only once a claim would actually succeed, so a UI driven by it cannot
    ///      fire an early, reverting claim.
    function timeUntilTimeout(uint256 gameId) external view gameExists(gameId) returns (uint256) {
        Game storage g = games[gameId];
        if (g.status != Status.InProgress) return 0;
        uint256 deadline = uint256(g.lastMoveTime) + MOVE_TIMEOUT;
        if (block.timestamp > deadline) return 0; // claim is now accepted
        if (block.timestamp == deadline) return 1; // one more second before a claim succeeds
        return deadline - block.timestamp;
    }

    // ---------------------------------------------------------------------
    // Internal game logic
    // ---------------------------------------------------------------------

    function _index(uint8 row, uint8 column) private pure returns (uint256) {
        return uint256(row) * COLS + uint256(column);
    }

    /// @dev Lowest empty row in a column (row 0 is the bottom). `placed` is false
    ///      when the column is full.
    function _lowestEmptyRow(Game storage g, uint8 column)
        private
        view
        returns (uint8 row, bool placed)
    {
        for (uint8 r = 0; r < ROWS; r++) {
            if (g.board[_index(r, column)] == EMPTY) {
                return (r, true);
            }
        }
        return (0, false);
    }

    function _isWinningMove(Game storage g, uint8 row, uint8 column, uint8 pid)
        private
        view
        returns (bool)
    {
        return _makesFour(g, row, column, 0, 1, pid) // horizontal
            || _makesFour(g, row, column, 1, 0, pid) // vertical
            || _makesFour(g, row, column, 1, 1, pid) // diagonal /
            || _makesFour(g, row, column, 1, -1, pid); // diagonal \
    }

    function _makesFour(Game storage g, uint8 row, uint8 column, int8 dr, int8 dc, uint8 pid)
        private
        view
        returns (bool)
    {
        int8 r = int8(row);
        int8 c = int8(column);
        uint8 count = 1;
        count += _countDirection(g, r, c, dr, dc, pid);
        count += _countDirection(g, r, c, -dr, -dc, pid);
        return count >= 4;
    }

    function _countDirection(Game storage g, int8 row, int8 column, int8 dr, int8 dc, uint8 pid)
        private
        view
        returns (uint8 count)
    {
        int8 r = row + dr;
        int8 c = column + dc;
        while (
            r >= 0 && r < int8(ROWS) && c >= 0 && c < int8(COLS)
                && g.board[uint256(int256(r)) * COLS + uint256(int256(c))] == pid
        ) {
            count++;
            r += dr;
            c += dc;
        }
    }
}
