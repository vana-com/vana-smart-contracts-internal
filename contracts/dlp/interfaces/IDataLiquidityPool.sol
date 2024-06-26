// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

interface IDataLiquidityPool is IAccessControl {
    enum ValidatorStatus {
        None,
        Registered,
        Active,
        Inactive,
        Deregistered
    }

    struct ValidatorInfo {
        address ownerAddress;
        uint256 stakeAmount;
        ValidatorStatus status;
        uint256 firstBlockNumber;
        uint256 lastBlockNumber;
        uint256 grantedAmount;
        uint256 filesToVerifyIndex;
        uint256 filesToVerifyCount;
        mapping(uint256 => uint256) filesToVerify;
        mapping(address => uint256) weights;
    }

    struct FileVerificationInfo {
        address validatorAddress;
        uint256 reportedAt;
        uint256 reportedAtBlock;
        uint256 score;
        uint256 authenticity;
        uint256 ownership;
        uint256 quality;
        uint256 uniqueness;
        string metadata;
    }

    struct File {
        address contributorAddress;
        uint256 addedAt;
        uint256 verificationsCount;
        string url;
        string encryptedKey;
        uint256 reward;
        uint256 rewardWithdrawn;
        bool isVerified;
        uint256 addedAtBlock;
        uint256 overallScore;
        uint256 authenticity;
        uint256 ownership;
        uint256 quality;
        uint256 uniqueness;
        mapping(address => FileVerificationInfo) verifications;
    }

    struct ValidatorReward {
        uint256 share;
        uint256 withdrawnAmount;
    }

    struct Epoch {
        uint256 startBlock;
        uint256 endBlock;
        uint256 reward;
        uint256 validatorsListId;
        mapping(address => ValidatorReward) validatorRewards;
    }

    struct ContributorInfo {
        uint256 fileIdsCount;
        mapping(uint256 => uint256) fileIds;
    }

    function token() external view returns (IERC20);
    function masterKey() external view returns (string memory);
    function maxNumberOfValidators() external view returns (uint256);
    function epochSize() external view returns (uint256);
    function validationPeriod() external view returns (uint256);
    function validatorScoreMinTrust() external view returns (uint256);
    function validatorScoreKappa() external view returns (uint256);
    function validatorScoreRho() external view returns (uint256);
    function activeValidatorsListsCount() external view returns (uint256);
    function epochsCount() external view returns (uint256);
    function minStakeAmount() external view returns (uint256);
    function totalStaked() external view returns (uint256);
    function totalValidatorsRewardAmount() external view returns (uint256);
    function totalContributorsRewardAmount() external view returns (uint256);
    function epochRewardAmount() external view returns (uint256);
    function fileRewardFactor() external view returns (uint256);
    function fileRewardDelay() external view returns (uint256);
    function getNextFileToVerify() external view returns (NextFileToVerify memory);
    struct FileResponse {
        uint256 fileId;
        address contributorAddress;
        string url;
        string encryptedKey;
        uint256 addedAt;
        uint256 reward;
        uint256 rewardWithdrawn;
        uint256 verificationsCount;
        bool isVerified;
    }
    function files(uint256 fileId) external view returns (FileResponse memory);
    function validatorsCount() external view returns (uint256);
    struct ValidatorInfoResponse {
        address validatorAddress;
        address ownerAddress;
        uint256 stakeAmount;
        ValidatorStatus status;
        uint256 firstBlockNumber;
        uint256 lastBlockNumber;
        uint256 grantedAmount;
        uint256 filesToVerifyIndex;
        uint256 filesToVerifyCount;
    }
    function validators(
        uint256 index
    ) external view returns (ValidatorInfoResponse memory);
    function validatorsInfo(
        address validatorAddress
    ) external view returns (ValidatorInfoResponse memory);
    function fileVerifications(
        uint256 fileId,
        address validatorAddress
    )
        external
        view
        returns (
            FileVerificationInfo memory
        );
    function contributorsCount() external view returns (uint256);
    struct ContributorInfoResponse {
        address contributorAddress;
        uint256 fileIdsCount;
    }
    function contributors(
        uint256 index
    ) external view returns (ContributorInfoResponse memory);
    function contributorInfo(
        address contributorAddress
    ) external view returns (ContributorInfoResponse memory);
    function contributorFiles(
        address contributorAddress,
        uint256 index
    ) external view returns (FileResponse memory);
    function updateMaxNumberOfValidators(
        uint256 newMaxNumberOfValidators
    ) external;
    function updateEpochSize(uint256 newEpochSize) external;
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external;
    function updateValidationPeriod(uint256 newValidationPeriod) external;
    function updateValidatorScoreMinTrust(
        uint256 newValidatorScoreMinTrust
    ) external;
    function updateValidatorScoreKappa(uint256 newValidatorScoreKappa) external;
    function updateValidatorScoreRho(uint256 newValidatorScoreRho) external;
    function updateMinStakeAmount(uint256 newMinStakeAmount) external;
    function updateFileRewardFactor(uint256 newFileRewardFactor) external;
    function updateFileRewardDelay(uint256 newFileRewardDelay) external;

    function activeValidatorsLists(
        uint256 id
    ) external view returns (address[] memory);

    function createEpochs() external;
    function createEpochsUntilBlockNumber(uint256 blockNumber) external;
    function registerValidator(
        address validatorAddress,
        address ownerAddress,
        uint256 stakeAmount
    ) external;
    struct NextFileToVerify {
        uint256 fileId;
        string url;
        string encryptedKey;
        uint256 addedTime;
    }

    function getFileInfo(uint256 fileId) external view returns (
        address contributorAddress,
        uint256 addedAt,
        uint256 verificationsCount,
        bool isVerified,
        uint256 overallScore,
        uint256 authenticity,
        uint256 ownership,
        uint256 quality,
        uint256 uniqueness,
        FileVerificationInfo[] memory validatorScores
    );

    function nextFileToVerifyId() external view returns (uint256);
    function lastAddedFileId() external view returns (uint256);
}
