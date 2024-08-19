// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IDataLiquidityPoolLight.sol";

/**
 * @title Storage for DataLiquidityPool
 * @notice For future upgrades, do not change DataLiquidityPoolStorageV1. Create a new
 * contract which implements DataLiquidityPoolStorageV1
 */
abstract contract DataLiquidityPoolLightStorageV1 is IDataLiquidityPoolLight {
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
    mapping(uint256 => File) internal _files;

    uint256 public override contributorsCount;
    mapping(uint256 => address) internal _contributors;
    mapping(address => ContributorInfo) internal _contributorInfo;
}
