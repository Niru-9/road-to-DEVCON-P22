// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {ConnectFour} from "../src/ConnectFour.sol";

contract ConnectFourTest is Test {
    ConnectFour game;

    address p1 = address(0xA11CE);
    address p2 = address(0xB0B);
    address other = address(0xC0FFEE);

    function setUp() public {
        game = new ConnectFour();
    }

    function _newGame() internal returns (uint256 id) {
        vm.prank(p1);
        id = game.createGame();
        vm.prank(p2);
        game.joinGame(id);
    }

    /// @dev Drop columns in order; p1 moves first (even indices), p2 odd.
    function _play(uint256 id, uint8[] memory cols) internal {
        for (uint256 i = 0; i < cols.length; i++) {
            address mover = (i % 2 == 0) ? p1 : p2;
            vm.prank(mover);
            game.move(id, cols[i]);
        }
    }

    // ----------------------------------------------------------------
    // Create / join
    // ----------------------------------------------------------------

    function testCreateAndJoin() public {
        vm.prank(p1);
        uint256 id = game.createGame();
        assertEq(id, 1);
        assertEq(game.gameCount(), 1);

        (
            address a,
            address b,
            address turn,
            address winner,
            ConnectFour.Status status,
            ,
            uint16 moves
        ) = game.getGame(id);
        assertEq(a, p1);
        assertEq(b, address(0));
        assertEq(turn, address(0)); // no active turn until an opponent joins
        assertEq(winner, address(0));
        assertEq(moves, 0);
        assertEq(uint8(status), uint8(ConnectFour.Status.WaitingForOpponent));

        vm.prank(p2);
        game.joinGame(id);
        (, address b2, address turn2, , ConnectFour.Status s2, , ) = game.getGame(id);
        assertEq(b2, p2);
        assertEq(turn2, p1); // player 1 moves first
        assertEq(uint8(s2), uint8(ConnectFour.Status.InProgress));
    }

    function testCannotJoinOwnGame() public {
        vm.prank(p1);
        uint256 id = game.createGame();
        vm.prank(p1);
        vm.expectRevert();
        game.joinGame(id);
    }

    // check 3: move rejects caller who is not on turn
    function testMoveWrongTurnReverts() public {
        uint256 id = _newGame();
        // It is p1's turn; p2 must not be able to move.
        vm.prank(p2);
        vm.expectRevert();
        game.move(id, 0);
    }

    function testMoveByStrangerReverts() public {
        uint256 id = _newGame();
        vm.prank(other);
        vm.expectRevert();
        game.move(id, 0);
    }

    // check 4: move rejects illegal placement
    function testMoveOutOfRangeReverts() public {
        uint256 id = _newGame();
        vm.prank(p1);
        vm.expectRevert();
        game.move(id, 7); // COLS == 7, valid columns are 0..6
    }

    function testMoveFullColumnReverts() public {
        uint256 id = _newGame();
        // Fill column 0 completely with alternating players (6 discs, no win).
        uint8[] memory cols = new uint8[](6);
        for (uint256 i = 0; i < 6; i++) cols[i] = 0;
        _play(id, cols);
        // Column 0 now full; the next mover (p1) cannot drop there.
        vm.prank(p1);
        vm.expectRevert();
        game.move(id, 0);
    }

    // check 5: winner set by the contract's own board check
    function testHorizontalWin() public {
        uint256 id = _newGame();
        uint8[] memory cols = new uint8[](7);
        cols[0] = 0; cols[1] = 6; cols[2] = 1; cols[3] = 6;
        cols[4] = 2; cols[5] = 6; cols[6] = 3;
        _play(id, cols);
        (, , , address winner, ConnectFour.Status status, , ) = game.getGame(id);
        assertEq(winner, p1);
        assertEq(uint8(status), uint8(ConnectFour.Status.Finished));
    }

    function testVerticalWin() public {
        uint256 id = _newGame();
        uint8[] memory cols = new uint8[](7);
        cols[0] = 0; cols[1] = 6; cols[2] = 0; cols[3] = 6;
        cols[4] = 0; cols[5] = 6; cols[6] = 0;
        _play(id, cols);
        (, , , address winner, ConnectFour.Status status, , ) = game.getGame(id);
        assertEq(winner, p1);
        assertEq(uint8(status), uint8(ConnectFour.Status.Finished));
    }

    function testDiagonalWin() public {
        uint256 id = _newGame();
        // Sequence verified by search: p1 completes a diagonal on the final move.
        uint8[] memory cols = new uint8[](13);
        cols[0] = 0; cols[1] = 1; cols[2] = 5; cols[3] = 2; cols[4] = 1; cols[5] = 2;
        cols[6] = 5; cols[7] = 3; cols[8] = 2; cols[9] = 3; cols[10] = 5; cols[11] = 3;
        cols[12] = 3;
        _play(id, cols);
        (, , , address winner, ConnectFour.Status status, , ) = game.getGame(id);
        assertEq(winner, p1);
        assertEq(uint8(status), uint8(ConnectFour.Status.Finished));
    }

    function testPlayer2Wins() public {
        uint256 id = _newGame();
        // Same shape as the horizontal test but p2 completes it.
        uint8[] memory cols = new uint8[](8);
        cols[0] = 6; cols[1] = 0; cols[2] = 5; cols[3] = 1;
        cols[4] = 6; cols[5] = 2; cols[6] = 5; cols[7] = 3;
        _play(id, cols);
        (, , , address winner, ConnectFour.Status status, , ) = game.getGame(id);
        assertEq(winner, p2);
        assertEq(uint8(status), uint8(ConnectFour.Status.Finished));
    }

    // check 6: no move after the game has ended
    function testMoveAfterFinishReverts() public {
        uint256 id = _newGame();
        uint8[] memory cols = new uint8[](7);
        cols[0] = 0; cols[1] = 6; cols[2] = 1; cols[3] = 6;
        cols[4] = 2; cols[5] = 6; cols[6] = 3; // p1 wins
        _play(id, cols);
        // Game finished; next mover p2 must be rejected.
        vm.prank(p2);
        vm.expectRevert();
        game.move(id, 4);
        // and joining / claiming is also impossible
        vm.prank(other);
        vm.expectRevert();
        game.joinGame(id);
    }

    // check 7: stalled game forfeited after a deadline
    function testTimeoutClaimTooEarlyReverts() public {
        uint256 id = _newGame();
        uint256 timeout = game.MOVE_TIMEOUT();
        // Non-active player (p2) tries before the deadline.
        vm.prank(p2);
        vm.expectRevert();
        game.claimTimeoutWin(id);
        // Still early just before the deadline.
        vm.warp(block.timestamp + timeout - 1);
        vm.prank(p2);
        vm.expectRevert();
        game.claimTimeoutWin(id);
        // Exactly at the deadline is still too early (strictly greater required).
        vm.warp(block.timestamp + 1);
        vm.prank(p2);
        vm.expectRevert();
        game.claimTimeoutWin(id);
    }

    function testTimeoutCannotBeClaimedByActivePlayer() public {
        uint256 id = _newGame();
        vm.warp(block.timestamp + game.MOVE_TIMEOUT() + 1);
        // It is p1's turn; p1 (the stalling player) must not be able to claim.
        vm.prank(p1);
        vm.expectRevert();
        game.claimTimeoutWin(id);
    }

    function testTimeoutCannotBeClaimedByStranger() public {
        uint256 id = _newGame();
        vm.warp(block.timestamp + game.MOVE_TIMEOUT() + 1);
        vm.prank(other);
        vm.expectRevert();
        game.claimTimeoutWin(id);
    }

    function testTimeoutClaimSucceedsAfterDeadline() public {
        uint256 id = _newGame();
        vm.warp(block.timestamp + game.MOVE_TIMEOUT() + 1);
        vm.prank(p2);
        game.claimTimeoutWin(id);
        (, , , address winner, ConnectFour.Status status, , ) = game.getGame(id);
        assertEq(winner, p2);
        assertEq(uint8(status), uint8(ConnectFour.Status.Finished));
    }

    function testTimeoutClockAdvancesWithMoves() public {
        uint256 id = _newGame();
        // p1 moves, so the deadline restarts from the move time.
        vm.prank(p1);
        game.move(id, 0);
        uint256 remaining = game.timeUntilTimeout(id);
        assertEq(remaining, game.MOVE_TIMEOUT());
    }

    // check 8: many games can run at once
    function testManyGamesRunConcurrently() public {
        uint256 idA = _newGame();
        vm.prank(p1);
        uint256 idB = game.createGame();
        vm.prank(other);
        game.joinGame(idB);

        vm.prank(p1);
        game.move(idA, 0);

        // Games have independent boards and turns.
        uint8[42] memory boardA = game.getBoard(idA);
        uint8[42] memory boardB = game.getBoard(idB);
        assertEq(boardA[0], 1); // idA has a p1 disc in column 0
        assertEq(boardB[0], 0); // idB is untouched
        assertEq(game.gameCount(), 2);
        (, , , , , , uint16 movesB) = game.getGame(idB);
        assertEq(movesB, 0);
    }

    // check 9: each move emits an event identifying the game (indexed)
    function testMoveEventCarriesIndexedGameId() public {
        uint256 id = _newGame();
        vm.recordLogs();
        vm.prank(p1);
        game.move(id, 3);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 moveSig = keccak256("MoveMade(uint256,address,uint8,uint8,uint8)");
        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == moveSig) {
                found = true;
                // gameId is the first indexed parameter -> topic 1
                assertEq(logs[i].topics[1], bytes32(id));
                assertEq(logs[i].emitter, address(game));
            }
        }
        assertTrue(found, "MoveMade event not emitted");
    }

    // check 10: game ends when no legal move remains (draw)
    function testDrawWhenBoardFull() public {
        uint256 id = _newGame();
        // Sequence verified by search: fills all 42 cells with no four-in-a-row.
        uint8[42] memory seq = [
            3, 3, 3, 3, 3, 3,
            2, 2, 2, 2, 2, 2,
            4, 4, 4, 4, 4, 4,
            0, 1, 1, 1, 1, 1,
            1, 5, 5, 5, 5, 5,
            5, 0, 0, 0, 0, 0,
            6, 6, 6, 6, 6, 6
        ];
        uint8[] memory cols = new uint8[](42);
        for (uint256 i = 0; i < 42; i++) cols[i] = seq[i];
        _play(id, cols);

        (, , , address winner, ConnectFour.Status status, , uint16 moves) = game.getGame(id);
        assertEq(moves, 42);
        assertEq(winner, address(0)); // draw
        assertEq(uint8(status), uint8(ConnectFour.Status.Finished));

        // Board is full: every column is occupied to the top.
        uint8[42] memory board = game.getBoard(id);
        for (uint256 c = 0; c < 7; c++) {
            assertTrue(board[5 * 7 + c] != 0, "top row should be full");
        }
    }

    // Board getter returns the stored board.
    function testBoardGetterReflectsMoves() public {
        uint256 id = _newGame();
        vm.prank(p1);
        game.move(id, 2);
        uint8[42] memory board = game.getBoard(id);
        assertEq(board[2], 1); // row 0, column 2 = player 1
    }
}
