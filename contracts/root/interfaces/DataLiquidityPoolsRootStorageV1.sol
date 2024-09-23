// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./IDataLiquidityPoolsRoot.sol";

/**`
 * @title Storage for DataLiquidityPoolsRoot
 * @notice For future upgrades, do not change DataLiquidityPoolsRootStorageV1. Create a new
 * contract which implements DataLiquidityPoolsRootStorageV1
 */
abstract contract DataLiquidityPoolsRootStorageV1 is IDataLiquidityPoolsRoot {
    uint256 public override maxNumberOfRegisteredDlps;
    uint256 public override numberOfTopDlps;
    uint256 public override minDlpStakeAmount;
    uint256 public override totalDlpsRewardAmount;
    uint256 public override epochRewardAmount;
    uint256 public override epochSize;

    uint256 public override ttfPercentage;
    uint256 public override tfcPercentage;
    uint256 public override vduPercentage;
    uint256 public override uwPercentage;

    uint256 public override dlpsCount;
    mapping(uint256 dlpId => Dlp dlp) internal _dlps;
    mapping(address dlpAddress => uint256 dlpId) public override dlpIds;

    EnumerableSet.UintSet internal _registeredDlps;

    uint256 public override epochsCount;
    mapping(uint256 epochId => Epoch epoch) internal _epochs;

    mapping(address stakerAddress => Staker staker) internal _stakers;
}
