// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

interface IDataLiquidityPoolsRoot is IAccessControl {
    enum DlpStatus {
        None,
        Registered,
        Active,
        Deregistered
    }

    struct DlpInfo {
        address payable ownerAddress;
        uint256 stakeAmount;
        DlpStatus status;
        uint256 firstBlockNumber;
        uint256 lastBlockNumber;
        uint256 grantedAmount;
        uint256 score;
    }

    struct DlpReward {
        uint256 score;
        uint256 withdrawnAmount;
    }

    struct Epoch {
        uint256 startBlock;
        uint256 endBlock;
        uint256 reward;
        uint256 dlpsListId;
        mapping(address => DlpReward) dlpRewards;
    }

    function version() external pure returns (uint256);
    function maxNumberOfDlps() external view returns (uint256);
    function epochSize() external view returns (uint256);
    function activeDlpsListsCount() external view returns (uint256);
    function activeDlpsLists(uint256 listId) external view returns (address[] memory);
    function epochsCount() external view returns (uint256);
    struct EpochResponse {
        uint256 startBlock;
        uint256 endBlock;
        uint256 reward;
        uint256 dlpsListId;
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
            address[] memory dlps,
            uint256[] memory score,
            uint256[] memory withdrawnAmounts
        );
    function minStakeAmount() external view returns (uint256);
    function totalStaked() external view returns (uint256);
    function totalDlpsRewardAmount() external view returns (uint256);
    function epochRewardAmount() external view returns (uint256);
    function dlpsCount() external view returns (uint256);
    struct DlpInfoResponse {
        address dlpAddress;
        address ownerAddress;
        uint256 stakeAmount;
        DlpStatus status;
        uint256 firstBlockNumber;
        uint256 lastBlockNumber;
        uint256 grantedAmount;
        uint256 score;
    }
    function dlps(uint256 index) external view returns (DlpInfoResponse memory);
    function dlpsInfo(
        address dlpAddress
    ) external view returns (DlpInfoResponse memory);
    function dlpScores() external view returns (address[] memory dlps, uint256[] memory scores);
    function pause() external;
    function unpause() external;
    function updateMaxNumberOfDlps(uint256 newMaxNumberOfDlps) external;
    function updateEpochSize(uint256 newEpochSize) external;
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external;
    function updateMinStakeAmount(uint256 newMinStakeAmount) external;
    function createEpochs() external;
    function createEpochsUntilBlockNumber(uint256 blockNumber) external;
    function registerDlp(
        address dlpAddress,
        address payable ownerAddress
    ) external payable;
    function approveDlp(address dlpAddress) external;
    function deregisterDlp(address dlpAddress) external;
    function deregisterDlpByOwner(
        address dlpAddress,
        uint256 unstakeAmount
    ) external;

    function updateScores(
        address[] memory dlps,
        uint256[] memory scores
    ) external;
    function addRewardForDlps() external payable;
}
