// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/IAccessControl.sol";

interface IFileRegistry is IAccessControl {
    struct ProofData {
        uint256 score;
        uint256 timestamp;
        string metadata;
        string proofUrl;
        string instruction;
    }

    struct Proof {
        bytes signature;
        ProofData data;
    }

    struct File {
        address ownerAddress;
        string url;
        uint256 addedAtBlock;
        uint256 proofsCount;
        mapping(uint256 => Proof) proofs;
    }

    struct FileResponse {
        uint256 id;
        address ownerAddress;
        string url;
        uint256 addedAtBlock;
    }

    function version() external pure returns (uint256);
    function filesCount() external view returns (uint256);
    function files(uint256 index) external view returns (FileResponse memory);
    function fileProofs(uint256 fileId, uint256 index) external view returns (Proof memory);
    function pause() external;
    function unpause() external;
    function addFile(string memory url) external returns (uint256);
    function addProof(uint256 fileId, Proof memory proof) external;
}
