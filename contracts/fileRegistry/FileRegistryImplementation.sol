// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./interfaces/FileRegistryStorageV1.sol";

import "hardhat/console.sol";

contract FileRegistryImplementation is
    UUPSUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    AccessControlUpgradeable,
    FileRegistryStorageV1
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /**
     * @notice Triggered when a file has been added
     *
     * @param fileId                            id of the file
     * @param ownerAddress                      address of the owner
     * @param url                               url of the file
     */
    event FileAdded(uint256 indexed fileId, address indexed ownerAddress, string url);

    /**
     * @notice Triggered when user has added an proof to the file
     *
     * @param fileId                            id of the file
     * @param account                        address of the account
     */
    event ProofAdded(uint256 indexed fileId, address indexed account);

    error NotFileOwner();

    /**
     * @notice Initialize the contract
     *
     * @param ownerAddress                      address of the owner
     */
    function initialize(address ownerAddress) external initializer {
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __AccessControl_init();

        _transferOwnership(ownerAddress);
    }

    /**
     * @notice Upgrade the contract
     * This function is required by OpenZeppelin's UUPSUpgradeable
     *
     * @param newImplementation                  new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner {}

    /**
     * @notice Returns the version of the contract
     */
    function version() external pure virtual override returns (uint256) {
        return 1;
    }

    /**
     * @dev Pauses the contract
     */
    function pause() external override onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     */
    function unpause() external override onlyOwner {
        _unpause();
    }

    /**
     * @notice Returns information about the file
     *
     * @param fileId                            id of the file
     * @return FileResponse                     information about the file
     */
    function files(uint256 fileId) external view returns (FileResponse memory) {
        File storage file = _files[fileId];

        return
            FileResponse({id: fileId, url: file.url, ownerAddress: file.ownerAddress, addedAtBlock: file.addedAtBlock});
    }

    function fileProofs(uint256 fileId, uint256 index) external view override returns (Proof memory) {
        return _files[fileId].proofs[index];
        //        return
        //            Proof({
        //                valid: _files[fileId].proofs[account].valid,
        //                score: _files[fileId].proofs[account].score,
        //                authenticity: _files[fileId].proofs[account].authenticity,
        //                ownership: _files[fileId].proofs[account].ownership,
        //                quality: _files[fileId].proofs[account].quality,
        //                uniqueness: _files[fileId].proofs[account].uniqueness
        //            });
    }

    /**
     * @notice Adds a file to the registry
     *
     * @param url                               url of the file
     * @return uint256                          id of the file
     */
    function addFile(string memory url) external override whenNotPaused returns (uint256) {
        _addFile(url);

        return filesCount;
    }

    /**
     * @notice Adds an proof to the file
     *
     * @param fileId                            id of the file
     * @param proof                       proof for the file
     */
    function addProof(uint256 fileId, Proof memory proof) external override whenNotPaused {
        _addProof(msg.sender, fileId, proof);
    }

    /**
     * @notice Adds an proof to the file
     *
     * @param fileId                            id of the file
     * @param proof                       proof for the file
     */
    function _addProof(address account, uint256 fileId, Proof memory proof) internal {
        _files[fileId].proofsCount++;
        _files[fileId].proofs[_files[fileId].proofsCount] = proof;

        emit ProofAdded(fileId, account);
    }

    /**
     * @notice Adds a file to the registry
     *
     * @param url                               url of the file
     */
    function _addFile(string memory url) internal {
        filesCount++;

        _files[filesCount].ownerAddress = msg.sender;
        _files[filesCount].url = url;
        _files[filesCount].addedAtBlock = block.number;

        emit FileAdded(filesCount, msg.sender, url);
    }
}
