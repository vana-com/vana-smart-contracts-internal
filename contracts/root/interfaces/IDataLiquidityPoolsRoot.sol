// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface IDataLiquidityPoolsRoot {
    enum DlpStatus {
        None,
        Registered,
        Deregistered
    }

    enum EpochStatus {
        None,
        Created,
        Finished
    }

    struct Epoch {
        uint256 startBlock;
        uint256 endBlock;
        uint256 reward;
        EnumerableSet.UintSet dlpIds;
        mapping(uint256 => EpochDlp) dlps;
        EpochStatus status;
    }

    struct Dlp {
        uint256 id;
        address dlpAddress;
        address payable ownerAddress;
        uint256 stakeAmount;
        DlpStatus status;
        uint256 registrationBlockNumber;
        uint256 grantedAmount;
        uint256 stakersPercentage;
    }

    struct EpochDlp {
        uint256 ttf;
        uint256 tfc;
        uint256 vdu;
        uint256 uw;
        uint256 stakersPercentage;
        uint256 stakedAmount;
        uint256 rewardAmount;
    }

    struct StakerDlpEpoch {
        uint256 stakedAmount;
        uint256 withdrawnReward;
    }

    struct StakerDlp {
        uint256 stakedAmount;
        mapping(uint256 => StakerDlpEpoch) epochs;
    }

    struct Staker {
        uint256 totalStaked;
        mapping(uint256 => StakerDlp) dlps;
    }

    struct DlpPerformance {
        uint256 dlpId;
        uint256 ttf;
        uint256 tfc;
        uint256 vdu;
        uint256 uw;
    }

    function version() external pure returns (uint256);
    function maxNumberOfDlps() external view returns (uint256);
    function epochSize() external view returns (uint256);
    function registeredDlps() external view returns (uint256[] memory);
    function epochsCount() external view returns (uint256);
    struct EpochResponse {
        uint256 startBlock;
        uint256 endBlock;
        uint256 reward;
        uint256[] dlpIds;
    }
    function epochs(uint256 epochId) external view returns (EpochResponse memory);
    function epochDlps(uint256 epochId, uint256 dlpId) external view returns (EpochDlp memory);
    function minDlpStakeAmount() external view returns (uint256);
    function totalDlpsRewardAmount() external view returns (uint256);
    function epochRewardAmount() external view returns (uint256);
    function ttfPercentage() external view returns (uint256);
    function tfcPercentage() external view returns (uint256);
    function vduPercentage() external view returns (uint256);
    function uwPercentage() external view returns (uint256);
    function dlpsCount() external view returns (uint256);
    struct DlpResponse {
        uint256 id;
        address dlpAddress;
        address ownerAddress;
        uint256 stakeAmount;
        DlpStatus status;
        uint256 registrationBlockNumber;
        uint256 grantedAmount;
    }
    function dlps(uint256 index) external view returns (DlpResponse memory);
    function dlpsByAddress(address dlpAddress) external view returns (DlpResponse memory);
    function dlpIds(address dlpAddress) external view returns (uint256);
    function stakers(address staker) external view returns (uint256);
    function stakerDlps(address staker, uint256 dlpId) external view returns (uint256);
    function stakerDlpEpochs(
        address staker,
        uint256 dlpId,
        uint256 epochId
    ) external view returns (StakerDlpEpoch memory);
    function getTopDlpsIds(uint256 numberOfDlps) external returns (uint256[] memory);
    function pause() external;
    function unpause() external;
    function updateMaxNumberOfDlps(uint256 newMaxNumberOfDlps) external;
    function updateEpochSize(uint256 newEpochSize) external;
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external;
    function updateMinDlpStakeAmount(uint256 newMinStakeAmount) external;
    function updatePerformancePercentages(
        uint256 newTtfPercentage,
        uint256 newTfcPercentage,
        uint256 newVduPercentage,
        uint256 newUwPercentage
    ) external;
    function createNextEpoch() external;
    function registerDlp(address dlpAddress, address payable ownerAddress) external payable;
    function registerDlpWithGrant(address dlpAddress, address payable ownerAddress) external payable;
    function updateDlpStakersPercentage(uint256 dlpId, uint256 stakersPercentage) external;
    function deregisterDlp(uint256 dlpId) external;
    function deregisterDlpByOwner(uint256 dlpId, uint256 unstakeAmount) external;
    function addRewardForDlps() external payable;
    function claimReward(uint256 epochNumber, uint256 dlpId) external;
    function stake(uint256 dlpId) external payable;
    function unstake(uint256 dlpId, uint256 amount) external;
    function saveEpochPerformances(uint256 epochId, DlpPerformance[] memory dlpPerformances, bool isFinal) external;
    function withdraw(address _token, address _to, uint256 _amount) external returns (bool success);
}
