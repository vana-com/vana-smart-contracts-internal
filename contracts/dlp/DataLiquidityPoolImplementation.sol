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

    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    using SafeERC20 for IERC20;

    /**
     * @notice Triggered when a reward has been requested for a file
     *
     * @param contributorAddress                 owner of the file
     * @param fileId                             file id from the registryData contract
     * @param proofIndex                         proof index
     * @param proofIndex                         proof index
     * @param rewardAmount                       reward amount
     */
    event RewardRequested(
        address indexed contributorAddress,
        uint256 indexed fileId,
        uint256 indexed proofIndex,
        uint256 rewardAmount
    );

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

    /**
     * @notice Triggered when the proofInstruction has been updated
     *
     * @param newProofInstruction                new proof instruction
     */
    event ProofInstructionUpdated(string newProofInstruction);

    /**
     * @notice Triggered when the masterKey has been updated
     *
     * @param newMasterKey                new master key
     */
    event MasterKeyUpdated(string newMasterKey);

    error FileAlreadyAdded();
    error InvalidAttestator();
    error InvalidProof();

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
        string proofInstruction;
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
        proofInstruction = params.proofInstruction;
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
                timestamp: file.timestamp,
                proofIndex: file.proofIndex,
                rewardAmount: file.rewardAmount
            });
    }

    /**
     * @notice Gets the files list count
     */
    function filesListCount() external view override returns (uint256) {
        return _filesList.length();
    }

    /**
     * @notice Gets the files list at index
     *
     * @param index                   index of the file
     */
    function filesListAt(uint256 index) external view override returns (uint256) {
        return _filesList.at(index);
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
                filesListCount: _contributorInfo[contributorAddress].filesList.length()
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
        return files(_contributorInfo[contributorAddress].filesList.at(index));
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
     * @notice Updates the proofInstruction
     *
     * @param newProofInstruction                new proof instruction
     */
    function updateProofInstruction(string calldata newProofInstruction) external override onlyOwner {
        proofInstruction = newProofInstruction;

        emit ProofInstructionUpdated(newProofInstruction);
    }

    /**
     * @notice Updates the masterKey
     *
     * @param newProofInstruction                new proof instruction
     */
    function updateMasterKey(string calldata newProofInstruction) external override onlyOwner {
        masterKey = newProofInstruction;

        emit MasterKeyUpdated(newProofInstruction);
    }

    /**
     * @notice Requests a reward for a file
     *
     * @param fileId                             file id from the registryData contract
     * @param proofIndex                         proof index
     */
    function requestReward(uint256 fileId, uint256 proofIndex) external override whenNotPaused nonReentrant {
        IDataRegistry.Proof memory fileProof = dataRegistry.fileProofs(fileId, proofIndex);

        if (keccak256(bytes(fileProof.data.instruction)) != keccak256(bytes(proofInstruction))) {
            revert InvalidProof();
        }

        File storage file = _files[fileId];

        if (file.rewardAmount != 0) {
            revert FileAlreadyAdded();
        }

        IDataRegistry.FileResponse memory registryFile = dataRegistry.files(fileId);

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

        file.timestamp = block.timestamp;
        file.proofIndex = proofIndex;
        file.rewardAmount = (fileRewardFactor * fileProof.data.score) / 1e18;

        _filesList.add(fileId);

        Contributor storage contributor = _contributorInfo[registryFile.ownerAddress];
        contributor.filesList.add(fileId);

        token.safeTransfer(registryFile.ownerAddress, file.rewardAmount);

        totalContributorsRewardAmount -= file.rewardAmount;

        if (contributor.filesList.length() == 1) {
            contributorsCount++;
            _contributors[contributorsCount] = registryFile.ownerAddress;
        }

        emit RewardRequested(registryFile.ownerAddress, fileId, proofIndex, file.rewardAmount);
    }

    /**
     * @notice Adds rewards for contributors
     */
    function addRewardsForContributors(uint256 contributorsRewardAmount) external override nonReentrant {
        token.safeTransferFrom(msg.sender, address(this), contributorsRewardAmount);
        totalContributorsRewardAmount += contributorsRewardAmount;
    }
}
