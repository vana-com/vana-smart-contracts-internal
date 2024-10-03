// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/DataLiquidityPoolStorageV1.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract DataLiquidityPoolImplementation is
    UUPSUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    ReentrancyGuardUpgradeable,
    DataLiquidityPoolStorageV1
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
     * @notice Triggered when a file has been validated
     *
     * @param fileId                             file id
     */
    event FileValidated(uint256 indexed fileId);

    /**
     * @notice Triggered when a file has been invalidated
     *
     * @param fileId                             file id
     */
    event FileInvalidated(uint256 indexed fileId);

    /**
     * @notice Triggered when the fileRewardFactor has been updated
     *
     * @param newFileRewardFactor                new file reward factor
     */
    event FileRewardFactorUpdated(uint256 newFileRewardFactor);

    error WithdrawNotAllowed();
    error FileAlreadyAdded();
    error InvalidFileStatus();
    error NotAllowed();
    error InvalidAttestator();
    error InvalidFileOwner();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    struct InitParams {
        address ownerAddress;
        address tokenAddress;
        address dataRegistryAddress;
        address teePoolAddress;
        string name;
        string masterKey;
        uint256 fileRewardFactor;
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

        name = params.name;
        dataRegistry = IDataRegistry(params.dataRegistryAddress);
        token = IERC20(params.tokenAddress);
        teePool = ITeePool(params.teePoolAddress);
        masterKey = params.masterKey;
        fileRewardFactor = params.fileRewardFactor;

        _transferOwnership(params.ownerAddress);
    }

    /**
     * @notice Upgrades the contract
     * This function is required by OpenZeppelin's UUPSUpgradeable
     *
     * @param newImplementation                  new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner {}

    /**
     * returns the version of the contract
     */
    function version() external pure virtual override returns (uint256) {
        return 1;
    }

    /**
     * @notice Gets the file information
     *
     * @param fileId                              file id
     */
    function files(uint256 fileId) public view override returns (FileResponse memory) {
        File storage file = _files[fileId];

        return
            FileResponse({
                fileId: fileId,
                status: file.status,
                registryId: file.registryId,
                timestamp: file.timestamp,
                proofIndex: file.proofIndex,
                rewardAmount: file.rewardAmount,
                rewardWithdrawn: file.rewardWithdrawn
            });
    }

    /**
     * @notice Gets the contributor information
     *
     * @param index                   index of the contributor
     * @return ContributorInfoResponse             contributor information
     */
    function contributors(uint256 index) external view override returns (ContributorInfoResponse memory) {
        return contributorInfo(_contributors[index]);
    }

    /**
     * @notice Gets the contributor information
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
     * @notice Gets the contributor files
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
     * @notice Updates the fileRewardFactor
     *
     * @param newFileRewardFactor                new file reward factor
     */
    function updateFileRewardFactor(uint256 newFileRewardFactor) external override onlyOwner {
        fileRewardFactor = newFileRewardFactor;

        emit FileRewardFactorUpdated(newFileRewardFactor);
    }

    /**
     * @notice Updates the teePool
     *
     * @param newTeePool                new tee pool
     */
    function updateTeePool(address newTeePool) external override onlyOwner {
        teePool = ITeePool(newTeePool);
    }

    /**
     * @notice Adds a file
     *
     * @param registryId                         file id from the registryData contract
     * @param proofIndex                         proof index
     */
    function addFile(uint256 registryId, uint256 proofIndex) external override whenNotPaused {
        IDataRegistry.Proof memory fileProof = dataRegistry.fileProofs(registryId, proofIndex);

        IDataRegistry.FileResponse memory registryFile = dataRegistry.files(registryId);

        if (registryFile.ownerAddress != msg.sender) {
            revert InvalidFileOwner();
        }

        bytes32 _messageHash = keccak256(
            abi.encodePacked(
                registryFile.url,
                fileProof.data.score,
                fileProof.data.dlpId,
                fileProof.data.metadata,
                fileProof.data.proofUrl,
                fileProof.data.instruction
            )
        );

        address signer = _messageHash.toEthSignedMessageHash().recover(fileProof.signature);

        if (!teePool.isTee(signer)) {
            revert InvalidAttestator();
        }

        filesCount++;

        File storage file = _files[filesCount];
        file.registryId = registryId;
        file.timestamp = block.timestamp;
        file.proofIndex = proofIndex;
        file.status = FileStatus.Added;
        file.rewardAmount = (fileRewardFactor * dataRegistry.fileProofs(registryId, proofIndex).data.score) / 1e18;

        Contributor storage contributor = _contributorInfo[msg.sender];
        contributor.fileIdsCount++;
        contributor.fileIds[contributor.fileIdsCount] = filesCount;

        if (contributor.fileIdsCount == 1) {
            contributorsCount++;
            _contributors[contributorsCount] = msg.sender;
        }

        emit FileAdded(msg.sender, filesCount);
    }

    /**
     * @notice Adds rewards for contributors
     */
    function addRewardsForContributors(uint256 contributorsRewardAmount) external override nonReentrant {
        token.safeTransferFrom(msg.sender, address(this), contributorsRewardAmount);
        totalContributorsRewardAmount += contributorsRewardAmount;
    }

    /**
     * @notice Validates a file and send the contribution reward
     *
     * @param fileId                             file id
     */
    function validateFile(uint256 fileId) external override onlyOwner {
        File storage file = _files[fileId];

        if (file.status != FileStatus.Added) {
            revert InvalidFileStatus();
        }

        if (file.rewardWithdrawn > 0 || totalContributorsRewardAmount < file.rewardAmount) {
            revert WithdrawNotAllowed();
        }

        IDataRegistry.FileResponse memory registryFile = dataRegistry.files(file.registryId);

        file.status = FileStatus.Validated;
        file.rewardWithdrawn = file.rewardAmount;
        token.safeTransfer(registryFile.ownerAddress, file.rewardAmount);

        totalContributorsRewardAmount -= file.rewardAmount;

        emit FileValidated(fileId);
    }

    /**
     * @notice Invalidates a file
     *
     * @param fileId                             file id
     */
    function invalidateFile(uint256 fileId) external override onlyOwner {
        File storage file = _files[fileId];

        if (file.status != FileStatus.Added) {
            revert InvalidFileStatus();
        }

        file.status = FileStatus.Rejected;

        emit FileInvalidated(fileId);
    }
}
