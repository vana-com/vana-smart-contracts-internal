// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./IDataLiquidityPoolOld.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title Storage for DataLiquidityPool
 * @notice For future upgrades, do not change DataLiquidityPoolStorageV1. Create a new
 * contract which implements DataLiquidityPoolStorageV1
 */
abstract contract DataLiquidityPoolOldStorageV1 is IDataLiquidityPoolOld {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    string public override name;
    IERC20 public override token;
    string public override masterKey;
    uint256 public override maxNumberOfValidators;
    uint256 public override minStakeAmount;
    uint256 public override totalStaked;
    uint256 public override totalValidatorsRewardAmount;
    uint256 public override totalContributorsRewardAmount;
    uint256 public override epochRewardAmount;
    uint256 public override epochSize;
    uint256 public override fileRewardFactor;
    uint256 public override validationPeriod;
    uint256 public override validatorScoreMinTrust;
    uint256 public override validatorScoreKappa;
    uint256 public override validatorScoreRho;
    uint256 public override fileRewardDelay;
    uint256 public override lastFinalizedFileId;

    uint256 public override validatorsCount;
    mapping(uint256 validatorId => address validatorAddress) internal _validators;
    mapping(address validatorAddress => ValidatorInfo validatorInfo) internal _validatorsInfo;

    uint256 public override activeValidatorsListsCount;
    mapping(uint256 activeValidatorId => EnumerableSet.AddressSet activeValidatorAddress)
        internal _activeValidatorsLists;

    mapping(uint256 fileId => File file) internal _files;
    EnumerableSet.Bytes32Set internal _fileUrlHashes;

    uint256 public override epochsCount;
    mapping(uint256 epochId => Epoch epoch) internal _epochs;

    uint256 public override contributorsCount;
    mapping(uint256 contributorId => address contributoirAddress) internal _contributors;
    mapping(address contributiorAddress => ContributorInfo contributor) internal _contributorInfo;
}
