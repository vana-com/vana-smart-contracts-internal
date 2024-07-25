// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/FileRegistryStorageV1.sol";

contract FileRegistryImplementation is
    UUPSUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    AccessControlUpgradeable,
    FileRegistryStorageV1
{
    /**
     * @notice Triggered when user has staked some DAT for a DLP
     *
     * @param staker                            address of the staker
     * @param dlpId                             id of the dlp
     * @param amount                            amount staked
     */
    event Staked(address indexed staker, uint256 indexed dlpId, uint256 amount);

    error InvalidStakeAmount();

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

    function files(uint256 fileId) external view returns (FileResponse memory) {
        File storage file = _files[fileId];

        return
            FileResponse({
                id: fileId,
                url: file.url,
                ownerAddress: file.ownerAddress,
                addedAtBlock: file.addedAtBlock,
                valid: file.valid,
                score: file.score,
                authenticity: file.authenticity,
                ownership: file.ownership,
                quality: file.quality,
                uniqueness: file.uniqueness,
                attestations: file.attestations
            });
    }

    function addFile(string memory url) external returns (uint256) {
        filesCount++;

        _files[filesCount].ownerAddress = msg.sender;
        _files[filesCount].url = url;

        return filesCount;
    }
}
