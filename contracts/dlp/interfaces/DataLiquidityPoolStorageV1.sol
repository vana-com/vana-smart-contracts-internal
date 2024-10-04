// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./IDataLiquidityPool.sol";

/**
 * @title Storage for DataLiquidityPool
 * @notice For future upgrades, do not change DataLiquidityPoolStorageV1. Create a new
 * contract which implements DataLiquidityPoolStorageV1
 */
abstract contract DataLiquidityPoolStorageV1 is IDataLiquidityPool {
    string public override name;
    IDataRegistry public override dataRegistry;
    IERC20 public override token;
    string public override masterKey;
    string public override proofInstruction;
    uint256 public override totalContributorsRewardAmount;
    uint256 public override fileRewardFactor;

    mapping(uint256 fileId => File file) internal _files;
    EnumerableSet.UintSet internal _filesList;

    uint256 public override contributorsCount;
    mapping(uint256 contributorId => address contributorAddress) internal _contributors;
    mapping(address contributirAddress => Contributor contributor) internal _contributorInfo;

    ITeePool public override teePool;
}
