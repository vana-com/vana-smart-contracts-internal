// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/IAccessControl.sol";

interface IFileRegistry is IAccessControl {
    struct File {
        address ownerAddress;
        string url;
        uint256 addedAtBlock;
        bool valid;
        uint256 score;
        uint256 authenticity;
        uint256 ownership;
        uint256 quality;
        uint256 uniqueness;
        string attestations;
        mapping(address => string) permissions;
    }

    struct FileResponse {
        uint256 id;
        address ownerAddress;
        string url;
        uint256 addedAtBlock;
        bool valid;
        uint256 score;
        uint256 authenticity;
        uint256 ownership;
        uint256 quality;
        uint256 uniqueness;
        string attestations;
    }

    function version() external pure returns (uint256);
    function filesCount() external view returns (uint256);
    function files(uint256 index) external view returns (FileResponse memory);
    function pause() external;
    function unpause() external;
    function addFile(string memory url) external returns (uint256);
}
