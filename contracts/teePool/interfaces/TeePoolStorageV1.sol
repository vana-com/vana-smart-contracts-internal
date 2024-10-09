// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./ITeePool.sol";

/**`
 * @title Storage for TeePool
 * @notice For future upgrades, do not change TeePoolStorageV1. Create a new
 * contract which implements TeePoolStorageV1
 */
abstract contract TeePoolStorageV1 is ITeePool {
    IDataRegistry public override dataRegistry;

    uint256 public override jobsCount;
    mapping(uint256 jobId => Job job) internal _jobs;

    EnumerableSet.AddressSet internal _teeList;
    EnumerableSet.AddressSet internal _activeTeeList;
    mapping(address teeAddress => Tee tee) internal _tees;

    uint256 public override teeFee;
    uint256 public override cancelDelay;

    mapping(uint256 fileId => EnumerableSet.UintSet jobId) internal _fileJobsIds;
}
