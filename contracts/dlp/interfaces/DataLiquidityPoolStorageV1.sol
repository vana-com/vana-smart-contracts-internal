// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IDataLiquidityPool.sol";

/**
 * @title Storage for DataLiquidityPool
 * @notice For future upgrades, do not change DataLiquidityPoolStorageV1. Create a new
 * contract which implements DataLiquidityPoolStorageV1
 */
abstract contract DataLiquidityPoolStorageV1 is IDataLiquidityPool {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    string public override name;
    IDataRegistry public override dataRegistry;
    IERC20 public override token;
    string public override masterKey;
    uint256 public override totalContributorsRewardAmount;
    uint256 public override fileRewardFactor;
    uint256 public override fileRewardDelay;

    uint256 public override filesCount;
    mapping(uint256 fileId => File file) internal _files;

    uint256 public override contributorsCount;
    mapping(uint256 contributorId => address contributorAddress) internal _contributors;
    mapping(address contributirAddress => Contributor contributor) internal _contributorInfo;

    ITeePool public override teePool;
}
