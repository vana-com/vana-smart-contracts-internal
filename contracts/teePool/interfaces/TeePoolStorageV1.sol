// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./ITeePool.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**`
 * @title Storage for TeePool
 * @notice For future upgrades, do not change TeePoolStorageV1. Create a new
 * contract which implements TeePoolStorageV1
 */
abstract contract TeePoolStorageV1 is ITeePool {
    IFileRegistry public override fileRegistry;

    uint256 public override jobsCount;
    mapping(uint256 => Job) internal _jobs;

    EnumerableSet.AddressSet internal _teeList;
    EnumerableSet.AddressSet internal _activeTeeList;
    mapping(address => Tee) internal _tees;
}
