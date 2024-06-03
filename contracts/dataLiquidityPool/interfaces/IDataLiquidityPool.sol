pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

interface IDataLiquidityPool is IAccessControl {
    enum ValidatorStatus {
        None,
        Registered,
        Active,
        Deregistered,
        Inactive,
        Blocked
    }

    struct ValidatorInfo {
        address payable ownerAddress;
        uint256 stakeAmount;
        ValidatorStatus status;
        uint256 filesToVerifyIndex;
        uint256 filesToVerifyCount;
        mapping(uint256 => uint256) filesToVerify;
        mapping(address => uint256) weights;
    }

    struct FileVerificationInfo {
        address validatorAddress;
        uint256 timespatmp;
        uint256 score;
        string metadata;
    }

    struct File {
        address ownerAddress;
        uint256 addedTimestamp;
        uint256 verificationsCount;
        string url;
        string encryptedKey;
        mapping(uint256 => FileVerificationInfo) verifications;
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
    function totalRewardAmount() external view returns (uint256);
    function epochRewardAmount() external view returns (uint256);
    function addingFilePaused() external view returns (bool);

    function updateMaxNumberOfValidators(uint256 newMaxNumberOfValidators) external;
    function updateEpochSize(uint256 newEpochSize) external;
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external;
    function updateValidationPeriod(uint256 newValidationPeriod) external;
    function updateValidatorScoreMinTrust(uint256 newValidatorScoreMinTrust) external;
    function updateValidatorScoreKappa(uint256 newValidatorScoreKappa) external;
    function updateValidatorScoreRho(uint256 newValidatorScoreRho) external;

    function activeValidatorsLists(
        uint256 id
    ) external view returns (address[] memory);
    function validatorInfo(
        address validatorAddress
    )
        external
        view
        returns (
            address ownerAddress,
            uint256 stakeAmount,
            ValidatorStatus status,
            uint256 filesToVerifyIndex,
            uint256 filesToVerifyCount
        );
    function fileVerifications(
        uint256 fileId,
        uint256 verificationId
    )
        external
        view
        returns (
            address validatorAddress,
            uint256 timespatmp,
            uint256 score,
            string memory metadata
        );
    function createEpochs() external;
    function createEpochsUntilBlockNumber(uint256 blockNumber) external;
    function registerValidator(
        address validatorAddress,
        address payable ownerAddress
    ) external payable;
    struct NextFileToVerify {
        uint256 fileId;
        string url;
        string encryptedKey;
        uint256 addedTime;
        address assignedValidator;
    }
    function getNextFileToVerify(
        address validatorAddress
    ) external view returns (NextFileToVerify memory);
    function files(
        uint256 fileId
    )
        external
        view
        returns (
            address ownerAddress,
            string memory url,
            string memory encryptedKey,
            uint256 addedTimestamp,
            uint256 verificationsCount
        );
}
