// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface IDataLiquidityPoolsRoot is IAccessControl {
    enum DlpStatus {
        None,
        Registered,
        Deregistered
    }

    struct Dlp {
        uint256 id;
        address dlpAddress;
        address payable ownerAddress;
        uint256 stakeAmount;
        DlpStatus status;
        uint256 firstBlockNumber;
        uint256 lastBlockNumber;
        uint256 grantedAmount;
        uint256 score;
    }

    struct EpochDlp {
        uint256 dlpId;
        uint256 score;
        uint256 withdrawnAmount;
        mapping(address => uint256) stakerAmounts;
    }

    struct Epoch {
        uint256 startBlock;
        uint256 endBlock;
        uint256 reward;
        EnumerableSet.UintSet dlpIds;
        mapping(uint256 => EpochDlp) dlps;
    }

    struct StakerInfo {
        uint256 totalStaked;
        mapping(uint256 => uint256) stakedDlps;
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
    function epochs(
        uint256 epochId
    ) external view returns (EpochResponse memory);
    function epochRewards(
        uint256 epochId
    )
        external
        view
        returns (
            uint256[] memory dlpIds,
            uint256[] memory score,
            uint256[] memory withdrawnAmounts
        );
    function minDlpStakeAmount() external view returns (uint256);
    function totalDlpsRewardAmount() external view returns (uint256);
    function epochRewardAmount() external view returns (uint256);
    function dlpsCount() external view returns (uint256);
    struct DlpResponse {
        uint256 id;
        address dlpAddress;
        address ownerAddress;
        uint256 stakeAmount;
        DlpStatus status;
        uint256 firstBlockNumber;
        uint256 lastBlockNumber;
        uint256 grantedAmount;
        uint256 score;
    }
    function dlps(uint256 index) external view returns (DlpResponse memory);
    function dlpsByAddress(
        address dlpAddress
    ) external view returns (DlpResponse memory);
    function dlpIds(
        address dlpAddress
    ) external view returns (uint256);
    function dlpScores() external view returns (uint256[] memory dlpIds, uint256[] memory scores);
    function stakers(address staker) external view returns (uint256 totalStaked);
    function stakedDlps(address staker, uint256 dlpId) external view returns (uint256 dlpStaked);
    function pause() external;
    function unpause() external;
    function updateMaxNumberOfDlps(uint256 newMaxNumberOfDlps) external;
    function updateEpochSize(uint256 newEpochSize) external;
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external;
    function updateMinDlpStakeAmount(uint256 newMinStakeAmount) external;
    function createEpochs() external;
    function createEpochsUntilBlockNumber(uint256 blockNumber) external;
    function registerDlp(
        address dlpAddress,
        address payable ownerAddress,
        bool granted
    ) external payable;
    function deregisterDlp(uint256 dlpId) external;
    function deregisterDlpByOwner(
        uint256 dlpId,
        uint256 unstakeAmount
    ) external;

    function updateScores(
        uint256[] memory dlpIds,
        uint256[] memory scores
    ) external;
    function addRewardForDlps() external payable;
    function claimUnsentReward(uint256 dlpId, uint256 epochNumber) external;
    function stake(uint256 dlpId) external payable;
}
