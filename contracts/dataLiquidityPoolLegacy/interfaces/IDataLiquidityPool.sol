// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

interface IDataLiquidityPool is IAccessControl {
    enum ValidatorStatus {
        None,
        Pending,
        Active,
        Inactive,
        Blocked
    }

    struct ValidatorInfo {
        uint256 id;
        address payable ownerAddress;
        uint256 stakeAmount;
        ValidatorStatus status;
        uint256 lastVerifiedFileId;
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
        uint256 verificationsLength;
        string url;
        string encryptedKey;
        mapping(uint256 => FileVerificationInfo) verifications;
    }

    struct ValidatorList {
        uint256 count;
        mapping(uint256 => address) validators;
    }

    struct ValidatorReward {
        uint256 share;
        uint256 withdrawedAmount;
    }

    struct RewardPeriod {
        uint256 startBlock;
        uint256 endBlock;
        uint256 reward;
        uint256 validatorListId;
        mapping(address => ValidatorReward) validatorRewards;
    }

    function masterKey() external view returns (string memory);
    function maxNumberOfValidators() external view returns (uint256);
    function rewardPeriodSize() external view returns (uint256);
    function validationPeriod() external view returns (uint256);
    function validatorScoreMinTrust() external view returns (uint256);
    function validatorScoreKappa() external view returns (uint256);
    function validatorScoreRho() external view returns (uint256);
    function activeValidatorListsCount() external view returns (uint256);
    function rewardPeriodsCount() external view returns (uint256);
    function minStakeAmount() external view returns (uint256);
    function totalStaked() external view returns (uint256);
    function totalRewardAmount() external view returns (uint256);
    function rewardAmount() external view returns (uint256);

    function activeValidatorLists(
        uint256 id
    ) external view returns (address[] memory);
    function validatorInfo(
        address validatorAddress
    )
        external
        view
        returns (
            uint256 id,
            address ownerAddress,
            uint256 stakeAmount,
            ValidatorStatus status,
            uint256 lastVerifiedFileId
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





    function createRewardPeriods() external;
    function registerAsValidator(
        address validatorAddress,
        address payable ownerAddress
    ) external payable;
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
            uint256 verificationsLength
        );
}
