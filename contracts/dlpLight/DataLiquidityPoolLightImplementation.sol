// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/DataLiquidityPoolLightStorageV1.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import "hardhat/console.sol";

contract DataLiquidityPoolLightImplementation is
    UUPSUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    DataLiquidityPoolLightStorageV1
{
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    using SafeERC20 for IERC20;

    /**
     * @notice Triggered when a file has been added
     *
     * @param contributorAddress                 owner of the file
     * @param fileId                             file id
     */
    event FileAdded(address indexed contributorAddress, uint256 fileId);

    /**
     * @notice Triggered when the fileRewardDelay has been updated
     *
     * @param newFileRewardDelay                new file reward delay
     */
    event FileRewardDelayUpdated(uint256 newFileRewardDelay);

    /**
     * @notice Triggered when the fileRewardFactor has been updated
     *
     * @param newFileRewardFactor                new file reward factor
     */
    event FileRewardFactorUpdated(uint256 newFileRewardFactor);

    /**
     * @notice Triggered when a data contributor has claimed a reward
     *
     * @param contributorAddress                 address of the contributor
     * @param fileId                             file id
     * @param amount                             amount claimed
     */
    event ContributionRewardClaimed(address indexed contributorAddress, uint256 fileId, uint256 amount);

    error WithdrawNotAllowed();
    error MasterKeyAlreadySet();
    error FileAlreadyAdded();
    error InvalidFileId();
    error ArityMismatch();
    error NotFileOwner();
    error NotAllowed();
    error NothingToClaim();

    struct InitParams {
        address ownerAddress;
        string name;
        address fileRegistryAddress;
        address tokenAddress;
        string masterKey;
        uint256 fileRewardFactor;
        uint256 fileRewardDelay;
    }

    /**
     * @notice Initialize the contract
     *
     * @param params                             initialization parameters
     */
    function initialize(InitParams memory params) external initializer {
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();

        name = params.name;
        fileRegistry = IFileRegistry(params.fileRegistryAddress);
        token = IERC20(params.tokenAddress);
        masterKey = params.masterKey;
        fileRewardFactor = params.fileRewardFactor;
        fileRewardDelay = params.fileRewardDelay;

        _transferOwnership(params.ownerAddress);
    }

    /**
     * @notice Upgrade the contract
     * This function is required by OpenZeppelin's UUPSUpgradeable
     *
     * @param newImplementation                  new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner {}

    /**
     * return the version of the contract
     */
    function version() external pure virtual override returns (uint256) {
        return 1;
    }

    /**
     * @notice Get the number of files
     */
    function filesCount() external view override returns (uint256) {
        return _fileUrlHashes.length();
    }

    /**
     * @notice Get the file information
     *
     * @param fileId                              file id
     */
    function files(uint256 fileId) public view override returns (FileResponse memory) {
        File storage file = _files[fileId];

        return
            FileResponse({
                fileId: fileId,
                registryId: file.registryId,
                timestamp: file.timestamp,
                proofIndex: file.proofIndex,
                rewardAmount: file.rewardAmount,
                rewardWithdrawn: file.rewardWithdrawn
            });
    }

    /**
     * @notice Get the contributor information
     *
     * @param index                   index of the contributor
     * @return ContributorInfoResponse             contributor information
     */
    function contributors(uint256 index) external view override returns (ContributorInfoResponse memory) {
        return contributorInfo(_contributors[index]);
    }

    /**
     * @notice Get the contributor information
     *
     * @param contributorAddress                   address of the contributor
     * @return ContributorInfoResponse             contributor information
     */
    function contributorInfo(address contributorAddress) public view override returns (ContributorInfoResponse memory) {
        return
            ContributorInfoResponse({
                contributorAddress: contributorAddress,
                fileIdsCount: _contributorInfo[contributorAddress].fileIdsCount
            });
    }

    /**
     * @notice Get the contributor files
     *
     * @param contributorAddress                   address of the contributor
     * @param index                                index of the file
     * @return uint256                             file id
     */
    function contributorFiles(
        address contributorAddress,
        uint256 index
    ) external view override returns (FileResponse memory) {
        return files(_contributorInfo[contributorAddress].fileIds[index]);
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
     * @notice Update the fileRewardFactor
     *
     * @param newFileRewardFactor                new file reward factor
     */
    function updateFileRewardFactor(uint256 newFileRewardFactor) external override onlyOwner {
        fileRewardFactor = newFileRewardFactor;

        emit FileRewardFactorUpdated(newFileRewardFactor);
    }

    /**
     * @notice Update the fileRewardDelay
     *
     * @param newFileRewardDelay                new file reward delay
     */
    function updateFileRewardDelay(uint256 newFileRewardDelay) external override onlyOwner {
        fileRewardDelay = newFileRewardDelay;

        emit FileRewardDelayUpdated(newFileRewardDelay);
    }

    function addFile(uint256 registryId, uint256 proofIndex) external override whenNotPaused {
        bytes32 urlHash = keccak256(abi.encodePacked(registryId));
        if (_fileUrlHashes.contains(urlHash)) {
            revert FileAlreadyAdded();
        }

        _fileUrlHashes.add(urlHash);
        uint256 fileId = _fileUrlHashes.length();

        File storage file = _files[fileId];
        file.registryId = registryId;
        file.timestamp = block.timestamp;
        file.proofIndex = proofIndex;

        ContributorInfo storage contributor = _contributorInfo[msg.sender];
        contributor.fileIdsCount++;
        contributor.fileIds[contributor.fileIdsCount] = fileId;

        if (contributor.fileIdsCount == 1) {
            contributorsCount++;
            _contributors[contributorsCount] = msg.sender;
        }

        emit FileAdded(msg.sender, fileId);
    }

    /**
     * @notice Add rewards for contributors
     */
    function addRewardsForContributors(uint256 contributorsRewardAmount) external override nonReentrant {
        token.safeTransferFrom(msg.sender, address(this), contributorsRewardAmount);
        totalContributorsRewardAmount += contributorsRewardAmount;
    }

    function claimContributionReward(uint256 fileId) external override {
        File storage file = _files[fileId];

        //        if (file.ownerAddress != msg.sender) {
        //            revert NotFileOwner();
        //        }

        if (
            file.rewardWithdrawn > 0 ||
            file.timestamp + fileRewardDelay > block.timestamp ||
            totalContributorsRewardAmount < file.rewardAmount
        ) {
            revert WithdrawNotAllowed();
        }

        file.rewardWithdrawn = file.rewardAmount;
        token.safeTransfer(msg.sender, file.rewardAmount);

        emit ContributionRewardClaimed(msg.sender, fileId, file.rewardAmount);
    }

    function testSignature(uint256 fileId, uint256 proofIndex) external view returns (address) {
        IFileRegistry.Proof memory fileProof = fileRegistry.fileProofs(fileId, proofIndex);

        bytes32 _messageHash = keccak256(
            abi.encodePacked(
                fileProof.data.score,
                fileProof.data.timestamp,
                fileProof.data.metadata,
                fileProof.data.proofUrl,
                fileProof.data.instruction
            )
        );

        address signer = _messageHash.toEthSignedMessageHash().recover(fileProof.signature);

        return signer;
    }
}
