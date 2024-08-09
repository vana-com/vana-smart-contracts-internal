// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import {IFileRegistry} from "../../fileRegistry/interfaces/IFileRegistry.sol";

interface IDataLiquidityPoolLight is IAccessControl {
    struct File {
        uint256 registryId;
        uint256 timestamp;
        uint256 proofIndex;
        uint256 rewardAmount;
        uint256 rewardWithdrawn;
    }

    struct ContributorInfo {
        uint256 fileIdsCount;
        mapping(uint256 => uint256) fileIds;
    }

    function name() external view returns (string memory);
    function version() external pure returns (uint256);
    function fileRegistry() external view returns (IFileRegistry);
    function token() external view returns (IERC20);
    function masterKey() external view returns (string memory);
    function totalContributorsRewardAmount() external view returns (uint256);
    function fileRewardFactor() external view returns (uint256);
    function fileRewardDelay() external view returns (uint256);

    function filesCount() external view returns (uint256);
    struct FileResponse {
        uint256 fileId;
        uint256 registryId;
        uint256 timestamp;
        uint256 proofIndex;
        uint256 rewardAmount;
        uint256 rewardWithdrawn;
    }
    function files(uint256 fileId) external view returns (FileResponse memory);
    function contributorsCount() external view returns (uint256);

    struct ContributorInfoResponse {
        address contributorAddress;
        uint256 fileIdsCount;
    }

    function contributors(uint256 index) external view returns (ContributorInfoResponse memory);
    function contributorInfo(address contributorAddress) external view returns (ContributorInfoResponse memory);
    function contributorFiles(address contributorAddress, uint256 index) external view returns (FileResponse memory);
    function pause() external;
    function unpause() external;
    function updateFileRewardFactor(uint256 newFileRewardFactor) external;
    function updateFileRewardDelay(uint256 newFileRewardDelay) external;
    function addFile(uint256 registryId, uint256 proofIndex) external;
    function addRewardsForContributors(uint256 contributorsRewardAmount) external;
    function claimContributionReward(uint256 fileId) external;
}
