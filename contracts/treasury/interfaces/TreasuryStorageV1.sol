// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./ITreasury.sol";

/**`
 * @title Storage for Treasury
 * @notice For future upgrades, do not change TreasuryStorageV1. Create a new
 * contract which implements TreasuryStorageV1
 */
abstract contract TreasuryStorageV1 is ITreasury {}
