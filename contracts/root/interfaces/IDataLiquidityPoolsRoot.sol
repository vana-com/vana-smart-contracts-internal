// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/structs/Checkpoints.sol";

interface IDataLiquidityPoolsRoot {
    enum DlpStatus {
        None,
        Registered,
        Deregistered
    }

    struct EpochDlp {
        uint256 ttf; //Total Transactions Facilitated by the DLP
        uint256 tfc; //Total Transaction Fees (Gas Costs) Created by the DLP
        uint256 vdu; //Total Number of Verified Data Uploads to the DLP
        uint256 uw; //Unique Wallets that Interacted with the DLP
        uint256 stakeAmount;
        uint256 rewardAmount;
        uint256 stakersPercentage;
    }

    struct Epoch {
        uint256 startBlock;
        uint256 endBlock;
        uint256 rewardAmount;
        EnumerableSet.UintSet dlpIds;
        bool isFinalised;
        mapping(uint256 dlpId => EpochDlp epochDlp) dlps;
    }

    struct DlpStaker {
        uint256 lastClaimedEpochId;
        Checkpoints.Trace208 stakeAmountCheckpoints;
        mapping(uint256 epochId => uint256 claimAmount) claimAmounts;
    }

    struct Dlp {
        uint256 id;
        address dlpAddress;
        address payable ownerAddress;
        DlpStatus status;
        uint256 registrationBlockNumber;
        uint256 stakersPercentage;
        uint256 grantedAmount;
        Checkpoints.Trace208 stakeAmountCheckpoints;
        mapping(address staker => DlpStaker dlpStaker) stakers;
    }

    struct Staker {
        EnumerableSet.UintSet dlpIds;
    }

    function version() external pure returns (uint256);
    function numberOfTopDlps() external view returns (uint256);
    function maxNumberOfRegisteredDlps() external view returns (uint256);
    function epochSize() external view returns (uint256);
    function registeredDlps() external view returns (uint256[] memory);
    function epochsCount() external view returns (uint256);
    struct EpochInfo {
        uint256 startBlock;
        uint256 endBlock;
        uint256 reward;
        bool isFinalised;
        uint256[] dlpIds;
    }
    function epochs(uint256 epochId) external view returns (EpochInfo memory);
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
        DlpStatus status;
        uint256 registrationBlockNumber;
        uint256 grantedAmount;
        uint256 stakersPercentage;
        uint256 stakeAmount;
    }
    function dlps(uint256 index) external view returns (DlpResponse memory);
    function dlpsByAddress(address dlpAddress) external view returns (DlpResponse memory);
    function dlpIds(address dlpAddress) external view returns (uint256);
    struct DlpEpochInfo {
        uint256 ttf; //Total Transactions Facilitated by the DLP
        uint256 tfc; //Total Transaction Fees (Gas Costs) Created by the DLP
        uint256 vdu; //Total Number of Verified Data Uploads to the DLP
        uint256 uw; //Unique Wallets that Interacted with the DLP
        uint256 stakeAmount;
        bool isTopDlp; //is in the top dlps list
        uint256 rewardAmount; // = 0 if isTopDlp is false or epoch is not finished
        uint256 stakersPercentage; // = 0 if isTopDlp is false
    }
    function dlpEpochs(uint256 dlpId, uint256 epochId) external view returns (DlpEpochInfo memory);
    struct StakerDlpInfo {
        uint256 dlpId;
        uint256 stakeAmount;
        uint256 lastClaimedEpochId;
    }
    function stakerDlpsListCount(address stakerAddress) external view returns (uint256);
    function stakerDlpsList(address stakerAddress) external view returns (StakerDlpInfo[] memory);
    function stakerDlps(address stakerAddress, uint256 dlpId) external view returns (StakerDlpInfo memory);
    struct StakerDlpEpochInfo {
        uint256 dlpId;
        uint256 epochId;
        uint256 stakeAmount; //stake amount at the start of the epoch
        uint256 rewardAmount; //reward amount at the end of the epoch
        uint256 claimAmount; //amount claimed by the staker
    }
    function stakerDlpEpochs(
        address stakerAddress,
        uint256 dlpId,
        uint256 epochId
    ) external view returns (StakerDlpEpochInfo memory);
    function topDlpIds(uint256 numberOfDlps) external returns (uint256[] memory);
    function claimableAmount(address stakerAddress, uint256 dlpId) external returns (uint256);
    function pause() external;
    function unpause() external;
    function updateNumberOfTopDlps(uint256 newNumberOfTopDlps) external;
    function updateMaxNumberOfRegisteredDlps(uint256 newMaxNumberOfRegisteredDlps) external;
    function updateEpochSize(uint256 newEpochSize) external;
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external;
    function updateMinDlpStakeAmount(uint256 newMinStakeAmount) external;
    function updatePerformancePercentages(
        uint256 newTtfPercentage,
        uint256 newTfcPercentage,
        uint256 newVduPercentage,
        uint256 newUwPercentage
    ) external;
    function createEpochs() external;
    function createEpochsUntilBlockNumber(uint256 blockNumber) external;
    function registerDlp(address dlpAddress, address payable ownerAddress, uint256 stakersPercentage) external payable;
    function registerDlpWithGrant(
        address dlpAddress,
        address payable ownerAddress,
        uint256 stakersPercentage
    ) external payable;
    function updateDlpStakersPercentage(uint256 dlpId, uint256 stakersPercentage) external;
    function deregisterDlp(uint256 dlpId) external;
    function distributeStakeAfterDeregistration(uint256 dlpId, uint256 dlpOwnerAmount) external;
    function addRewardForDlps() external payable;
    function claimRewardUntilEpoch(uint256 dlpId, uint256 lastEpochToClaim) external;
    function claimReward(uint256 dlpId) external;
    function stake(uint256 dlpId) external payable;
    function unstake(uint256 dlpId, uint256 amount) external;
    struct DlpPerformance {
        uint256 dlpId;
        uint256 ttf; //Total Transactions Facilitated by the DLP
        uint256 tfc; //Total Transaction Fees (Gas Costs) Created by the DLP
        uint256 vdu; //Total Number of Verified Data Uploads to the DLP
        uint256 uw; //Unique Wallets that Interacted with the DLP
    }
    function saveEpochPerformances(uint256 epochId, DlpPerformance[] memory dlpPerformances, bool isFinalised) external;
}
