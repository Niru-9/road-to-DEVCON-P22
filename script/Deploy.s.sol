// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ConnectFour} from "../src/ConnectFour.sol";

/// @notice Deploys ConnectFour to Ethereum Sepolia (chain id 11155111).
/// @dev Reads PRIVATE_KEY and SEPOLIA_RPC_URL from the environment. Never commit them.
///      Usage:
///        forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
contract Deploy is Script {
    function run() external returns (ConnectFour game) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        game = new ConnectFour();
        vm.stopBroadcast();
        console2.log("ConnectFour deployed at:", address(game));
    }
}
