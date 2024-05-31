// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./IDataLiquidityPool.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title Storage for DataLiquidityPool
 * @notice For future upgrades, do not change DataLiquidityPoolV1. Create a new
 * contract which implements DataLiquidityPoolV1
 */
abstract contract DataLiquidityPoolStorageV1 is IDataLiquidityPool {
    string public override masterKey;
    uint256 public override maxNumberOfValidators;
    uint256 public override minStakeAmount;
    uint256 public override totalStaked;
    uint256 public override totalRewardAmount;
    uint256 public override rewardAmount;
    uint256 public rewardPeriodSize;

    uint256 public override validationPeriod;
    uint256 public override validatorScoreMinTrust;
    uint256 public override validatorScoreKappa;
    uint256 public override validatorScoreRho;

    mapping(address => ValidatorInfo) internal _validatorInfo;
    EnumerableSet.AddressSet internal _validators;

    uint256 public override activeValidatorListsCount;
    mapping(uint256 => ValidatorList) internal _activeValidatorLists;

    mapping(uint256 => File) internal _files;
    EnumerableSet.Bytes32Set internal _fileUrls;

    uint256 public override rewardPeriodsCount;
    mapping(uint256 => RewardPeriod) internal _rewardPeriods;
}
