// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./interfaces/FileRegistryStorageV1.sol";

import "hardhat/console.sol";

contract FileRegistryImplementation is
    UUPSUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    AccessControlUpgradeable,
    FileRegistryStorageV1
{
    /**
     * @notice Triggered when a file has been added
     *
     * @param fileId                            id of the file
     * @param ownerAddress                      address of the owner
     * @param url                               url of the file
     */
    event FileAdded(uint256 indexed fileId, address indexed ownerAddress, string url);

    /**
     * @notice Triggered when user has requested permission for a file
     *
     * @param fileId                            id of the file
     * @param account                        address of the account
     */
    event PermissionRequested(uint256 indexed fileId, address indexed account);

    /**
     * @notice Triggered when user has authorized an account to access the file
     *
     * @param fileId                            id of the file
     * @param account                        address of the account
     */
    event PermissionGranted(uint256 indexed fileId, address indexed account);

    /**
     * @notice Triggered when user has added an proof to the file
     *
     * @param fileId                            id of the file
     * @param account                        address of the account
     */
    event ProofAdded(uint256 indexed fileId, address indexed account);

    error NotFileOwner();
    error NotFileAttestator();

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
            FileResponse({
                id: fileId,
                url: file.url,
                ownerAddress: file.ownerAddress,
                addedAtBlock: file.addedAtBlock,
                permissionRequestsCount: file.permissionRequestsCount
            });
    }

    /**
     * @notice Returns permission requests for the file
     *
     * @param fileId                            id of the file
     * @param index                             index of the permission request
     * @return address                          address of the account who requested permission
     */
    function filePermissionRequests(uint256 fileId, uint256 index) external view override returns (address) {
        return _files[fileId].permissionRequests[index];
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
     * @notice Returns proofs for the file
     *
     * @param fileId                            id of the file
     * @param account                        address of the account
     * @return Proof                      proof for the file
     */
    function fileProofs(uint256 fileId, address account) external view override returns (Proof memory) {
        //        return _files[fileId].proofs[account];
        return
            Proof({
                valid: _files[fileId].proofs[account].valid,
                score: _files[fileId].proofs[account].score,
                authenticity: _files[fileId].proofs[account].authenticity,
                ownership: _files[fileId].proofs[account].ownership,
                quality: _files[fileId].proofs[account].quality,
                uniqueness: _files[fileId].proofs[account].uniqueness
            });
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
     * @notice Adds a file to the registry
     *
     * @param url                               url of the file
     * @param permissions                    permissions for the file
     * @return uint256                          id of the file
     */
    function addFileWithPermissions(
        string memory url,
        FilePermissions[] memory permissions
    ) external override whenNotPaused returns (uint256) {
        _addFile(url);
        _addPermissions(filesCount, permissions);

        return filesCount;
    }

    /**
     * @notice Requests permission for the file
     *
     * @param fileId                            id of the file
     */
    function requestPermission(uint256 fileId) external override whenNotPaused {
        _files[fileId].permissionRequestsCount++;
        _files[fileId].permissionRequests[_files[fileId].permissionRequestsCount] = msg.sender;

        emit PermissionRequested(fileId, msg.sender);
    }

    /**
     * @notice Adds permissions for accounts to access the file
     *
     * @param fileId                            id of the file
     * @param permissions                    permissions for the file
     */
    function addPermissions(uint256 fileId, FilePermissions[] memory permissions) external override whenNotPaused {
        if (msg.sender != _files[fileId].ownerAddress) {
            revert NotFileOwner();
        }

        _addPermissions(fileId, permissions);
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
    function addProofOrigin(uint256 fileId, Proof memory proof) external override whenNotPaused {
        _addProof(tx.origin, fileId, proof);
    }

    /**
     * @notice Adds an proof to the file
     *
     * @param fileId                            id of the file
     * @param proof                       proof for the file
     */
    function _addProof(address account, uint256 fileId, Proof memory proof) internal {
        if (bytes(_files[fileId].permissions[account]).length == 0) {
            revert NotFileAttestator();
        }

        _files[fileId].proofs[account] = proof;

        emit ProofAdded(fileId, account);
    }

    /**
     * @notice Adds permissions for accounts to access the file
     *
     * @param fileId                            id of the file
     * @param permissions                    permissions for the file
     */
    function _addPermissions(uint256 fileId, FilePermissions[] memory permissions) internal {
        for (uint256 i = 0; i < permissions.length; i++) {
            address account = permissions[i].account;
            string memory key = permissions[i].key;

            _files[fileId].permissions[account] = key;

            emit PermissionGranted(fileId, account);
        }
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
