// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./IDataLiquidityPoolsRoot.sol";

/**`
 * @title Storage for DataLiquidityPoolsRoot
 * @notice For future upgrades, do not change DataLiquidityPoolsRootStorageV1. Create a new
 * contract which implements DataLiquidityPoolsRootStorageV1
 */
abstract contract DataLiquidityPoolsRootStorageV1 is IDataLiquidityPoolsRoot {
    uint256 public override maxNumberOfDlps;
    uint256 public override minDlpStakeAmount;
    uint256 public override totalDlpsRewardAmount;
    uint256 public override epochRewardAmount;
    uint256 public override epochSize;

    uint256 public override dlpsCount;
    mapping(uint256 => Dlp) internal _dlps;
    mapping(address => uint256) public override dlpIds;

    EnumerableSet.UintSet internal _registeredDlps;

    uint256 public override epochsCount;
    mapping(uint256 => Epoch) internal _epochs;

    mapping(address => StakerInfo) internal _stakers;
}
