// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IFileRegistry} from "../../fileRegistry/interfaces/IFileRegistry.sol";

interface ITeePool {
    enum TeeStatus {
        None,
        Active,
        Removed
    }

    enum JobStatus {
        None,
        Completed
    }

    struct Job {
        uint256 fileId;
        uint256 bidAmount;
        JobStatus status;
    }

    struct Tee {
        TeeStatus status;
        uint256 amount;
        uint256 withdrawnAmount;
    }

    struct TeeInfo {
        address teeAddress;
        TeeStatus status;
        uint256 amount;
        uint256 withdrawnAmount;
    }

    function version() external pure returns (uint256);
    function fileRegistry() external view returns (IFileRegistry);
    function jobsCount() external view returns (uint256);
    function jobs(uint256 jobId) external view returns (Job memory);
    //    function jobProofs(uint256 jobId, address entity) external view returns (Proof memory);
    function tees(address teeAddress) external view returns (TeeInfo memory);
    function teesCount() external view returns (uint256);
    function teeList() external view returns (address[] memory);
    function teeListAt(uint256 index) external view returns (TeeInfo memory);
    function activeTeesCount() external view returns (uint256);
    function activeTeeList() external view returns (address[] memory);
    function activeTeeListAt(uint256 index) external view returns (TeeInfo memory);
    function pause() external;
    function unpause() external;
    function updateFileRegistry(IFileRegistry fileRegistry) external;
    function addTee(address teeAddress) external;
    function removeTee(address teeAddress) external;
    function submitValidationJob(uint256 fileId) external payable;
    function submitProof(uint256 fileId, IFileRegistry.Proof memory proof) external payable;
}
