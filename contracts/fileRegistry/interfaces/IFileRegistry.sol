// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/IAccessControl.sol";

interface IFileRegistry is IAccessControl {
    struct Proof {
        bool valid;
        uint256 score;
        uint256 authenticity;
        uint256 ownership;
        uint256 quality;
        uint256 uniqueness;
    }

    struct File {
        address ownerAddress;
        string url;
        uint256 addedAtBlock;
        uint256 permissionRequestsCount;
        mapping(uint256 => address) permissionRequests;
        mapping(address => string) permissions;
        mapping(address => Proof) proofs;
    }

    struct FileResponse {
        uint256 id;
        address ownerAddress;
        string url;
        uint256 addedAtBlock;
        uint256 permissionRequestsCount;
    }

    struct FilePermissions {
        address account;
        string key;
    }

    function version() external pure returns (uint256);
    function filesCount() external view returns (uint256);
    function files(uint256 index) external view returns (FileResponse memory);
    function filePermissionRequests(uint256 fileId, uint256 index) external view returns (address);
    function filePermissions(uint256 fileId, address account) external view returns (string memory);
    function fileProofs(uint256 fileId, address account) external view returns (Proof memory);
    function pause() external;
    function unpause() external;
    function addFile(string memory url) external returns (uint256);
    function addFileWithPermissions(string memory url, FilePermissions[] memory permissions) external returns (uint256);
    function requestPermission(uint256 fileId) external;
    function addPermission(uint256 fileId, FilePermissions[] memory permissions) external;
    function addProof(uint256 fileId, Proof memory proof) external;
    function addProofOrigin(uint256 fileId, Proof memory proof) external;
}
