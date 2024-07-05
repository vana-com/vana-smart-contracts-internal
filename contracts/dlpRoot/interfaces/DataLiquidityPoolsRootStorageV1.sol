// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./IDataLiquidityPoolsRoot.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**`
 * @title Storage for DataLiquidityPoolsRoot
 * @notice For future upgrades, do not change DataLiquidityPoolsRootStoragelV1. Create a new
 * contract which implements DataLiquidityPoolsRootStorageV1
 */
abstract contract DataLiquidityPoolsRootStorageV1 is IDataLiquidityPoolsRoot {
    uint256 public override maxNumberOfDlps;
    uint256 public override minStakeAmount;
    uint256 public override totalDlpsRewardAmount;
    uint256 public override epochRewardAmount;
    uint256 public override epochSize;

    uint256 public override dlpsCount;
    mapping(uint256 => address) internal _dlps;
    mapping(address => DlpInfo) internal _dlpsInfo;

    uint256 public override activeDlpsListsCount;
    mapping(uint256 => EnumerableSet.AddressSet) internal _activeDlpsLists;

    uint256 public override epochsCount;
    mapping(uint256 => Epoch) internal _epochs;

    mapping(address => StakerInfo) internal _stakersInfo;
    // mapping(uint256 => StakerInfo) internal _stakerInfo;
    // mapping(address => StakerInfo) internal _stakerInfo;

}
