// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IDataRegistry} from "../../dataRegistry/interfaces/IDataRegistry.sol";

interface ITeePool {
    enum TeeStatus {
        None,
        Active,
        Removed
    }

    enum JobStatus {
        None,
        Submitted,
        Completed,
        Canceled
    }

    struct Job {
        uint256 fileId;
        uint256 bidAmount;
        JobStatus status;
        uint256 addedTimestamp;
        address ownerAddress;
    }

    struct Tee {
        TeeStatus status;
        string url;
        uint256 amount;
        uint256 withdrawnAmount;
    }

    function version() external pure returns (uint256);
    function dataRegistry() external view returns (IDataRegistry);
    function cancelDelay() external view returns (uint256);
    function jobsCount() external view returns (uint256);
    function jobs(uint256 jobId) external view returns (Job memory);
    struct TeeInfo {
        address teeAddress;
        string url;
        TeeStatus status;
        uint256 amount;
        uint256 withdrawnAmount;
    }
    function tees(address teeAddress) external view returns (TeeInfo memory);
    function teesCount() external view returns (uint256);
    function teeList() external view returns (address[] memory);
    function teeListAt(uint256 index) external view returns (TeeInfo memory);
    function activeTeesCount() external view returns (uint256);
    function activeTeeList() external view returns (address[] memory);
    function activeTeeListAt(uint256 index) external view returns (TeeInfo memory);
    function isTee(address teeAddress) external view returns (bool);
    function teeFee() external view returns (uint256);
    function jobTee(uint256 jobId) external view returns (TeeInfo memory);
    function pause() external;
    function unpause() external;
    function updateDataRegistry(IDataRegistry dataRegistry) external;
    function updateTeeFee(uint256 newTeeFee) external;
    function updateCancelDelay(uint256 newCancelDelay) external;
    function addTee(address teeAddress, string memory url) external;
    function removeTee(address teeAddress) external;
    function requestContributionProof(uint256 fileId) external payable;
    function submitJob(uint256 fileId) external payable;
    function cancelJob(uint256 jobId) external;
    function addProof(uint256 fileId, IDataRegistry.Proof memory proof) external payable;
}
