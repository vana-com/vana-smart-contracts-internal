// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IDataRegistry {
    struct ProofData {
        uint256 score;
        uint256 dlpId;
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
        mapping(uint256 proofId => Proof proof) proofs;
        mapping(address account => string key) permissions;
    }

    struct FileResponse {
        uint256 id;
        address ownerAddress;
        string url;
        uint256 addedAtBlock;
    }

    struct Permission {
        address account;
        string key;
    }

    function version() external pure returns (uint256);
    function filesCount() external view returns (uint256);
    function files(uint256 index) external view returns (FileResponse memory);
    function fileProofs(uint256 fileId, uint256 index) external view returns (Proof memory);
    function filePermissions(uint256 fileId, address account) external view returns (string memory);
    function pause() external;
    function unpause() external;
    function addFile(string memory url) external returns (uint256);
    function addFileWithPermissions(
        string memory url,
        address ownerAddress,
        Permission[] memory permissions
    ) external returns (uint256);
    function addProof(uint256 fileId, Proof memory proof) external;
    function addFilePermission(uint256 fileId, address account, string memory key) external;
}
