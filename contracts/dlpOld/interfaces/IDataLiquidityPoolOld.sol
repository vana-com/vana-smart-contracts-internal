// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDataLiquidityPoolOld {
    enum ValidatorStatus {
        None,
        Registered,
        Active,
        Deregistered
    }

    struct ValidatorInfo {
        address ownerAddress;
        uint256 stakeAmount;
        ValidatorStatus status;
        uint256 firstBlockNumber;
        uint256 lastBlockNumber;
        uint256 grantedAmount;
        uint256 lastVerifiedFile;
        mapping(address => uint256) weights;
    }

    struct FileScore {
        bool valid;
        uint256 score;
        uint256 reportedAtBlock;
        uint256 authenticity;
        uint256 ownership;
        uint256 quality;
        uint256 uniqueness;
    }

    struct File {
        address ownerAddress;
        string url;
        string encryptedKey;
        uint256 addedTimestamp;
        uint256 verificationsCount;
        uint256 addedAtBlock;
        bool valid;
        bool finalized;
        uint256 score;
        uint256 authenticity;
        uint256 ownership;
        uint256 quality;
        uint256 uniqueness;
        mapping(address => FileScore) scores;
        uint256 reward;
        uint256 rewardWithdrawn;
        uint256 validatorScoreCount;
    }

    struct ValidatorReward {
        uint256 score;
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

    function name() external view returns (string memory);
    function version() external pure returns (uint256);
    function token() external view returns (IERC20);
    function masterKey() external view returns (string memory);
    function maxNumberOfValidators() external view returns (uint256);
    function epochSize() external view returns (uint256);
    function validationPeriod() external view returns (uint256);
    function validatorScoreMinTrust() external view returns (uint256);
    function validatorScoreKappa() external view returns (uint256);
    function validatorScoreRho() external view returns (uint256);
    function activeValidatorsListsCount() external view returns (uint256);
    function activeValidatorsLists(uint256 id) external view returns (address[] memory);
    function epochsCount() external view returns (uint256);

    struct EpochResponse {
        uint256 startBlock;
        uint256 endBlock;
        uint256 reward;
        uint256 validatorsListId;
    }

    function epochs(uint256 epochId) external view returns (EpochResponse memory);
    function epochRewards(
        uint256 epochId
    ) external view returns (address[] memory validators, uint256[] memory scores, uint256[] memory withdrawnAmounts);
    function minStakeAmount() external view returns (uint256);
    function totalStaked() external view returns (uint256);
    function totalValidatorsRewardAmount() external view returns (uint256);
    function totalContributorsRewardAmount() external view returns (uint256);
    function epochRewardAmount() external view returns (uint256);
    function fileRewardFactor() external view returns (uint256);
    function fileRewardDelay() external view returns (uint256);
    function lastFinalizedFileId() external view returns (uint256);

    function getNextFileToVerify(address validatorAddress) external view returns (FileResponse memory);

    struct FileResponse {
        uint256 fileId;
        address ownerAddress;
        string url;
        string encryptedKey;
        uint256 addedTimestamp;
        uint256 addedAtBlock;
        bool valid;
        bool finalized;
        uint256 score;
        uint256 authenticity;
        uint256 ownership;
        uint256 quality;
        uint256 uniqueness;
        uint256 reward;
        uint256 rewardWithdrawn;
        uint256 verificationsCount;
    }

    function filesCount() external view returns (uint256);
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
        uint256 lastVerifiedFile;
    }

    function validators(uint256 index) external view returns (ValidatorInfoResponse memory);
    function validatorsInfo(address validatorAddress) external view returns (ValidatorInfoResponse memory);
    function validatorWeights(
        address validatorAddress
    ) external view returns (address[] memory validators, uint256[] memory weights);
    function fileScores(uint256 fileId, address validatorAddress) external view returns (FileScore memory);
    function contributorsCount() external view returns (uint256);

    struct ContributorInfoResponse {
        address contributorAddress;
        uint256 fileIdsCount;
    }

    function contributors(uint256 index) external view returns (ContributorInfoResponse memory);
    function contributorInfo(address contributorAddress) external view returns (ContributorInfoResponse memory);
    function contributorFiles(address contributorAddress, uint256 index) external view returns (FileResponse memory);
    function getEmissionScores(uint256 epochNumber) external view returns (uint256[] memory);
    function pause() external;
    function unpause() external;
    function updateMaxNumberOfValidators(uint256 newMaxNumberOfValidators) external;
    function updateEpochSize(uint256 newEpochSize) external;
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external;
    function updateValidationPeriod(uint256 newValidationPeriod) external;
    function updateValidatorScoreMinTrust(uint256 newValidatorScoreMinTrust) external;
    function updateValidatorScoreKappa(uint256 newValidatorScoreKappa) external;
    function updateValidatorScoreRho(uint256 newValidatorScoreRho) external;
    function updateMinStakeAmount(uint256 newMinStakeAmount) external;
    function updateFileRewardFactor(uint256 newFileRewardFactor) external;
    function updateFileRewardDelay(uint256 newFileRewardDelay) external;
    function createEpochs() external;
    function createEpochsUntilBlockNumber(uint256 blockNumber) external;
    function registerValidator(address validatorAddress, address ownerAddress, uint256 stakeAmount) external;
    function approveValidator(address validatorAddress) external;
    function deregisterValidator(address validatorAddress) external;
    function deregisterValidatorByOwner(address validatorAddress, uint256 unstakeAmount) external;
    function setMasterKey(string memory newMasterKey) external;
    function addFile(string memory url, string memory encryptedKey) external;
    function verifyFile(
        uint256 fileId,
        bool valid,
        uint256 score,
        uint256 authenticity,
        uint256 ownership,
        uint256 quality,
        uint256 uniqueness
    ) external;
    function updateWeights(address[] memory validators, uint256[] memory weights) external;
    function addRewardForValidators(uint256 validatorsRewardAmount) external;
    function addRewardsForContributors(uint256 contributorsRewardAmount) external;
    function claimContributionReward(uint256 fileId) external;
    function claimUnsentReward(address validatorAddress, uint256 epochNumber) external;
}
