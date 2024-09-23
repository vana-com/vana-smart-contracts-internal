// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./interfaces/DataRegistryStorageV1.sol";

contract DataRegistryImplementation is
    UUPSUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    DataRegistryStorageV1
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
     * @param proofIndex                        index of the proof
     */
    event ProofAdded(uint256 indexed fileId, uint256 indexed proofIndex);

    /**
     * @notice Triggered when user has authorized an account to access the file
     *
     * @param fileId                            id of the file
     * @param account                        address of the account
     */
    event PermissionGranted(uint256 indexed fileId, address indexed account);

    error NotFileOwner();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     *
     * @param ownerAddress                      address of the owner
     */
    function initialize(address ownerAddress) external initializer {
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();

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

    /**
     * @notice Returns the proof of the file
     *
     * @param fileId                            id of the file
     * @param index                             index of the proof
     * @return Proof                            proof of the file
     */
    function fileProofs(uint256 fileId, uint256 index) external view override returns (Proof memory) {
        return _files[fileId].proofs[index];
    }

    /**
     * @notice Returns permissions for the file
     *
     * @param fileId                            id of the file
     * @param account                        address of the account
     * @return string                           key for the account
     */
    function filePermissions(uint256 fileId, address account) external view override returns (string memory) {
        return _files[fileId].permissions[account];
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
        uint256 cachedProofCount = ++_files[fileId].proofsCount;

        _files[fileId].proofs[cachedProofCount] = proof;

        emit ProofAdded(fileId, cachedProofCount);
    }

    /**
     * @notice Adds permissions for accounts to access the file
     *
     * @param fileId                            id of the file
     * @param account                           address of the account
     * @param key                               encryption key for the account
     */
    function addFilePermission(uint256 fileId, address account, string memory key) external override whenNotPaused {
        if (msg.sender != _files[fileId].ownerAddress) {
            revert NotFileOwner();
        }

        _files[fileId].permissions[account] = key;
        emit PermissionGranted(fileId, account);
    }

    /**
     * @notice Adds a file to the registry
     *
     * @param url                               url of the file
     */
    function _addFile(string memory url) internal {
        uint256 cachedFilesCount = ++filesCount;

        _files[cachedFilesCount].ownerAddress = msg.sender;
        _files[cachedFilesCount].url = url;
        _files[cachedFilesCount].addedAtBlock = block.number;

        emit FileAdded(cachedFilesCount, msg.sender, url);
    }
}
