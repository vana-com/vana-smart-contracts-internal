// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDataRegistry} from "../../dataRegistry/interfaces/IDataRegistry.sol";
import {ITeePool} from "../../teePool/interfaces/ITeePool.sol";

interface IDataLiquidityPool {
    enum FileStatus {
        None,
        Added,
        Validated,
        Rejected
    }
    struct File {
        FileStatus status;
        uint256 registryId;
        uint256 timestamp;
        uint256 proofIndex;
        uint256 rewardAmount;
        uint256 rewardWithdrawn;
    }

    struct Contributor {
        uint256 fileIdsCount;
        mapping(uint256 => uint256) fileIds;
    }

    function name() external view returns (string memory);
    function version() external pure returns (uint256);
    function dataRegistry() external view returns (IDataRegistry);
    function teePool() external view returns (ITeePool);
    function token() external view returns (IERC20);
    function masterKey() external view returns (string memory);
    function totalContributorsRewardAmount() external view returns (uint256);
    function fileRewardFactor() external view returns (uint256);
    function fileRewardDelay() external view returns (uint256);

    function filesCount() external view returns (uint256);
    struct FileResponse {
        uint256 fileId;
        FileStatus status;
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
    function updateTeePool(address newTeePool) external;
    function addFile(uint256 registryId, uint256 proofIndex) external;
    function addRewardsForContributors(uint256 contributorsRewardAmount) external;
    function validateFile(uint256 fileId) external;
    function invalidateFile(uint256 fileId) external;
}
