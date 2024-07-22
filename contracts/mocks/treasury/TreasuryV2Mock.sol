// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Treasury} from "../../treasury/Treasury.sol";

contract TreasuryV2Mock is Treasury {
    /**
     * @notice Upgrade the contract
     * This function is required by OpenZeppelin's UUPSUpgradeable
     *
     * @param newImplementation                  new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner {}

    /**
     * return the version of the contract
     */
    function version() external pure virtual override returns (uint256) {
        return 2;
    }

    /**
     * @notice Tests the contract upgradeability
     */
    function test() external view returns (string memory) {
        return "test";
    }
}
