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
    uint256 public override epochRewardAmount;
    uint256 public override epochSize;
    uint256 public override validationPeriod;
    uint256 public override validatorScoreMinTrust;
    uint256 public override validatorScoreKappa;
    uint256 public override validatorScoreRho;

    bool public override addingFilePaused;

    mapping(address => ValidatorInfo) internal _validatorInfo;
    EnumerableSet.AddressSet internal _validators;

    uint256 public override activeValidatorsListsCount;
    mapping(uint256 => EnumerableSet.AddressSet) internal _activeValidatorsLists;
    EnumerableSet.AddressSet internal _validatorsWithFilesToVerify;

    mapping(uint256 => File) internal _files;
    EnumerableSet.Bytes32Set internal _fileUrlHases;

    uint256 public override epochsCount;
    mapping(uint256 => Epoch) internal _epochs;
}
