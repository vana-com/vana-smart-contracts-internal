// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/DataLiquidityPoolOldStorageV1.sol";

contract DataLiquidityPoolOldImplementation is
    UUPSUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    ReentrancyGuardUpgradeable,
    DataLiquidityPoolOldStorageV1
{
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    using SafeERC20 for IERC20;

    /**
     * @notice Triggered when a validator has staked some VANA
     *
     * @param validatorAddress                   address of the validator
     * @param amount                             amount staked in this call
     * @param totalAmount                        total amount staked by the validator
     */
    event Staked(address indexed validatorAddress, uint256 amount, uint256 totalAmount);

    /**
     * @notice Triggered when a validator has unstaked some VANA
     *
     * @param stakerAddress                      address of the staker
     * @param amount                             amount unstaked
     */
    event Unstaked(address indexed stakerAddress, uint256 amount);

    /**
     * @notice Triggered when a validator has registered
     *
     * @param validatorAddress                   address of the validator
     * @param ownerAddress                       owner of the validator
     * @param amount                             amount staked in this call
     */
    event ValidatorRegistered(address indexed validatorAddress, address indexed ownerAddress, uint256 amount);

    /**
     * @notice Triggered when a validator has been unregistered
     *
     * @param validatorAddress                   address of the validator
     */
    event ValidatorUnregistered(address indexed validatorAddress);

    /**
     * @notice Triggered when a validator has been approved
     *
     * @param validatorAddress                   address of the validator
     */
    event ValidatorApproved(address indexed validatorAddress);

    /**
     * @notice Triggered when a validator has been deregistered
     *
     * @param validatorAddress                   address of the validator
     */
    event ValidatorDeregistered(address indexed validatorAddress);

    /**
     * @notice Triggered when a validator has been deregistered by the dlp owner
     *
     * @param validatorAddress                   address of the validator
     * @param unstakedAmount                    amount unstaked
     * @param penaltyAmount                      penalty amount
     */
    event ValidatorDeregisteredByOwner(address indexed validatorAddress, uint256 unstakedAmount, uint256 penaltyAmount);

    /**
     * @notice Triggered when a master key has been set
     *
     * @param newMasterKey                       new master key
     */
    event MasterKeySet(string newMasterKey);

    /**
     * @notice Triggered when a file has been added
     *
     * @param contributorAddress                 owner of the file
     * @param fileId                             file id
     */
    event FileAdded(address indexed contributorAddress, uint256 fileId);

    /**
     * @notice Triggered when a file has been verified
     *
     * @param validatorAddress                   address of the validator
     * @param fileId                             file id
     * @param score                              score of the verification
     */
    event FileVerified(address indexed validatorAddress, uint256 fileId, uint256 score);

    /**
     * @notice Triggered when a epoch has been created
     *
     * @param epochId                  reward epoch id
     */
    event EpochCreated(uint256 epochId);

    /**
     * @notice Triggered when a validator has updated its weights
     *
     * @param validatorAddress                   address of the validator
     * @param validators                         validators
     * @param weights                            weights
     */
    event WeightsUpdated(address indexed validatorAddress, address[] validators, uint256[] weights);

    /**
     * @notice Triggered when the max number of validators has been updated
     *
     * @param newMaxNumberOfValidators           new max number of validators
     */
    event MaxNumberOfValidatorsUpdated(uint256 newMaxNumberOfValidators);

    /**
     * @notice Triggered when the epoch size has been updated
     *
     * @param newEpochSize                new epoch size
     */
    event EpochSizeUpdated(uint256 newEpochSize);

    /**
     * @notice Triggered when the epoch reward amount has been updated
     *
     * @param newEpochRewardAmount                new epoch reward amount
     */
    event EpochRewardAmountUpdated(uint256 newEpochRewardAmount);

    /**
     * @notice Triggered when the validation period has been updated
     *
     * @param newValidationPeriod                new validation period
     */
    event ValidationPeriodUpdated(uint256 newValidationPeriod);

    /**
     * @notice Triggered when the validatorScoreMinTrust has been updated
     *
     * @param newValidatorScoreMinTrust                new validatorScoreMinTrust
     */
    event ValidatorScoreMinTrustUpdated(uint256 newValidatorScoreMinTrust);

    /**
     * @notice Triggered when the validatorScoreKappa has been updated
     *
     * @param newValidatorScoreKappa                new validatorScoreKappa
     */
    event ValidatorScoreKappaUpdated(uint256 newValidatorScoreKappa);

    /**
     * @notice Triggered when the validatorScoreRho has been updated
     *
     * @param newValidatorScoreRho                new validatorScoreRho
     */
    event ValidatorScoreRhoUpdated(uint256 newValidatorScoreRho);

    /**
     * @notice Triggered when the minStakeAmount has been updated
     *
     * @param newMinStakeAmount                new minStakeAmount
     */
    event MinStakeAmountUpdated(uint256 newMinStakeAmount);

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

    /**
     * @notice Triggered when a validator has claimed un unsed reward
     *
     * @param validator                           address of the validator
     * @param epochId                             epcoch id
     * @param claimAmount                         amount claimed
     */
    event EpochRewardClaimed(address validator, uint256 epochId, uint256 claimAmount);

    error InvalidStakeAmount();
    error InvalidValidatorStatus();
    error TooManyValidators();
    error NotValidatorOwner();
    error WithdrawNotAllowed();
    error MasterKeyAlreadySet();
    error FileAlreadyAdded();
    error FileAlreadyVerified();
    error InvalidFileId();
    error ArityMismatch();
    error NotFileOwner();
    error NotAllowed();
    error NothingToClaim();
    error NotFinalized();

    /**
     * @dev Modifier to make a function callable only when the caller is an active validator
     */
    modifier onlyActiveValidators() {
        if (_validatorsInfo[msg.sender].status != ValidatorStatus.Active) {
            revert InvalidValidatorStatus();
        }
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the caller is the owner of the validator
     *
     * @param validatorAddress                         address of the validator
     */
    modifier onlyValidatorOwner(address validatorAddress) {
        if (_validatorsInfo[validatorAddress].ownerAddress != msg.sender) {
            revert NotValidatorOwner();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    struct InitParams {
        string name;
        address ownerAddress;
        address tokenAddress;
        uint256 newMaxNumberOfValidators;
        uint256 newValidatorScoreMinTrust;
        uint256 newValidatorScoreKappa;
        uint256 newValidatorScoreRho;
        uint256 newValidationPeriod;
        uint256 newMinStakeAmount;
        uint256 startBlock;
        uint256 newEpochSize;
        uint256 newEpochRewardAmount;
        uint256 newFileRewardFactor;
        uint256 newFileRewardDelay;
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
        maxNumberOfValidators = params.newMaxNumberOfValidators;
        validatorScoreMinTrust = params.newValidatorScoreMinTrust;
        validatorScoreKappa = params.newValidatorScoreKappa;
        validatorScoreRho = params.newValidatorScoreRho;
        minStakeAmount = params.newMinStakeAmount;
        validationPeriod = params.newValidationPeriod;
        epochSize = params.newEpochSize;
        epochRewardAmount = params.newEpochRewardAmount;
        token = IERC20(params.tokenAddress);
        fileRewardFactor = params.newFileRewardFactor;
        fileRewardDelay = params.newFileRewardDelay;

        epochsCount = 1;

        Epoch storage firstEpoch = _epochs[1];
        firstEpoch.startBlock = params.startBlock;
        firstEpoch.endBlock = params.startBlock + params.newEpochSize - 1;
        firstEpoch.reward = params.newEpochRewardAmount;

        emit EpochCreated(1);

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
                ownerAddress: file.ownerAddress,
                url: file.url,
                encryptedKey: file.encryptedKey,
                addedTimestamp: file.addedTimestamp,
                addedAtBlock: file.addedAtBlock,
                valid: file.valid,
                finalized: file.finalized,
                score: file.score,
                authenticity: file.authenticity,
                ownership: file.ownership,
                quality: file.quality,
                uniqueness: file.uniqueness,
                reward: file.reward,
                rewardWithdrawn: file.rewardWithdrawn,
                verificationsCount: file.verificationsCount
            });
    }

    /**
     * @notice Get the file scores for a validator
     *
     * @param fileId                   file id
     * @param validatorAddress         validator address
     */
    function fileScores(uint256 fileId, address validatorAddress) external view override returns (FileScore memory) {
        return _files[fileId].scores[validatorAddress];
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
     * @notice Get the validator information
     *
     * @param index                         index of the validator
     */
    function validators(uint256 index) external view override returns (ValidatorInfoResponse memory) {
        return validatorsInfo(_validators[index]);
    }

    /**
     * @notice Get the validator information
     *
     * @param validatorAddress                         address of the validator
     */
    function validatorsInfo(address validatorAddress) public view override returns (ValidatorInfoResponse memory) {
        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];
        return
            ValidatorInfoResponse({
                validatorAddress: validatorAddress,
                ownerAddress: validator.ownerAddress,
                stakeAmount: validator.stakeAmount,
                status: validator.status,
                firstBlockNumber: validator.firstBlockNumber,
                lastBlockNumber: validator.lastBlockNumber,
                grantedAmount: validator.grantedAmount,
                lastVerifiedFile: validator.lastVerifiedFile
            });
    }

    /**
     * @notice Get the next file to verify
     *
     * @param validatorAddress                   address of the validator
     */
    function getNextFileToVerify(address validatorAddress) public view override returns (FileResponse memory) {
        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];
        if (validator.status != ValidatorStatus.Active) {
            revert InvalidValidatorStatus();
        }

        uint256 nextFileId = Math.max(validator.lastVerifiedFile, lastFinalizedFileId) + 1;

        return files(nextFileId > _fileUrlHashes.length() ? 0 : nextFileId);
    }

    /**
     * @notice Get epoch information
     *
     * @param epochId                         epoch id
     */
    function epochs(uint256 epochId) external view override returns (EpochResponse memory) {
        Epoch storage epoch = _epochs[epochId];
        return
            EpochResponse({
                startBlock: epoch.startBlock,
                endBlock: epoch.endBlock,
                reward: epoch.reward,
                validatorsListId: epoch.validatorsListId
            });
    }

    /**
     * @notice Get active validator list by listId
     */
    function activeValidatorsLists(uint256 id) public view override returns (address[] memory) {
        return _activeValidatorsLists[id].values();
    }

    /**
     * @notice Get the epoch rewards
     *
     * @param epochId                              epoch id
     *
     * @return validators                          validators
     * @return scores                               scores
     * @return withdrawnAmounts                    withdrawnAmounts
     */
    function epochRewards(
        uint256 epochId
    )
        external
        view
        override
        returns (address[] memory validators, uint256[] memory scores, uint256[] memory withdrawnAmounts)
    {
        EnumerableSet.AddressSet storage epochValidators = _activeValidatorsLists[_epochs[epochId].validatorsListId];
        uint256 epochValidatorsCount = epochValidators.length();

        validators = new address[](epochValidatorsCount);
        scores = new uint256[](epochValidatorsCount);
        withdrawnAmounts = new uint256[](epochValidatorsCount);

        Epoch storage epoch = _epochs[epochId];

        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            validators[i] = epochValidators.at(i);
            scores[i] = epoch.validatorRewards[validators[i]].score;
            withdrawnAmounts[i] = epoch.validatorRewards[validators[i]].withdrawnAmount;
        }
    }

    /**
     * @notice Get weights assigned by the validator
     */
    function validatorWeights(
        address validatorAddress
    ) external view override returns (address[] memory validators, uint256[] memory weights) {
        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        EnumerableSet.AddressSet storage epochValidators = _activeValidatorsLists[
            _epochs[epochsCount].validatorsListId
        ];
        uint256 epochValidatorsCount = epochValidators.length();

        weights = new uint256[](epochValidatorsCount);
        validators = new address[](epochValidatorsCount);

        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            validators[i] = epochValidators.at(i);
            weights[i] = validator.weights[epochValidators.at(i)];
        }
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
     * @notice Update the maximum number of validators
     *
     * @param newMaxNumberOfValidators           new maximum number of validators
     */
    function updateMaxNumberOfValidators(uint256 newMaxNumberOfValidators) external override onlyOwner {
        maxNumberOfValidators = newMaxNumberOfValidators;

        emit MaxNumberOfValidatorsUpdated(newMaxNumberOfValidators);
    }

    /**
     * @notice Update the epoch size
     *
     * @param newEpochSize                new epoch size
     */
    function updateEpochSize(uint256 newEpochSize) external override onlyOwner {
        epochSize = newEpochSize;

        emit EpochSizeUpdated(newEpochSize);
    }

    /**
     * @notice Update the epochRewardAmount
     *
     * @param newEpochRewardAmount                new epoch size
     */
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external override onlyOwner {
        createEpochs();
        epochRewardAmount = newEpochRewardAmount;

        _epochs[epochsCount].reward = newEpochRewardAmount;

        emit EpochRewardAmountUpdated(newEpochRewardAmount);
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

    /**
     * @notice Update the validation period
     *
     * @param newValidationPeriod                new validation period
     */
    function updateValidationPeriod(uint256 newValidationPeriod) external override onlyOwner {
        validationPeriod = newValidationPeriod;
        emit ValidationPeriodUpdated(newValidationPeriod);
    }

    /**
     * @notice Update the validatorScoreMinTrust
     *
     * @param newValidatorScoreMinTrust                new validatorScoreMinTrust
     */
    function updateValidatorScoreMinTrust(uint256 newValidatorScoreMinTrust) external override onlyOwner {
        validatorScoreMinTrust = newValidatorScoreMinTrust;

        emit ValidatorScoreMinTrustUpdated(newValidatorScoreMinTrust);
    }

    /**
     * @notice Update the validatorScoreKappa
     *
     * @param newValidatorScoreKappa                new validatorScoreKappa
     */
    function updateValidatorScoreKappa(uint256 newValidatorScoreKappa) external override onlyOwner {
        validatorScoreKappa = newValidatorScoreKappa;

        emit ValidatorScoreKappaUpdated(newValidatorScoreKappa);
    }

    /**
     * @notice Update the validatorScoreRho
     *
     * @param newValidatorScoreRho                new validatorScoreRho
     */
    function updateValidatorScoreRho(uint256 newValidatorScoreRho) external override onlyOwner {
        validatorScoreRho = newValidatorScoreRho;

        emit ValidatorScoreRhoUpdated(newValidatorScoreRho);
    }

    /**
     * @notice Update the minStakeAmount
     *
     * @param newMinStakeAmount                new minStakeAmount
     */
    function updateMinStakeAmount(uint256 newMinStakeAmount) external override onlyOwner {
        minStakeAmount = newMinStakeAmount;

        emit MinStakeAmountUpdated(newMinStakeAmount);
    }

    /**
     * @notice Register a validator
     *
     * @param validatorAddress                   address of the validator
     * @param validatorOwnerAddress              owner of the validator
     * @param stakeAmount                        amount to stake
     */
    function registerValidator(
        address validatorAddress,
        address validatorOwnerAddress,
        uint256 stakeAmount
    ) external override whenNotPaused nonReentrant {
        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        if (validator.status != ValidatorStatus.None) {
            revert InvalidValidatorStatus();
        }

        if (stakeAmount < minStakeAmount) {
            revert InvalidStakeAmount();
        }

        token.safeTransferFrom(msg.sender, address(this), stakeAmount);

        validator.ownerAddress = validatorOwnerAddress;
        validator.stakeAmount = stakeAmount;
        validator.status = ValidatorStatus.Registered;

        if (msg.sender == owner()) {
            validator.grantedAmount = stakeAmount;
        }

        validatorsCount++;
        _validators[validatorsCount] = validatorAddress;

        totalStaked += stakeAmount;

        emit ValidatorRegistered(validatorAddress, validatorOwnerAddress, stakeAmount);
    }

    function approveValidator(address validatorAddress) external override onlyOwner {
        createEpochs();
        uint256 index;

        EnumerableSet.AddressSet storage activeValidatorsList = _activeValidatorsLists[activeValidatorsListsCount];
        uint256 activeValidatorsListCount = activeValidatorsList.length();

        activeValidatorsListsCount++;

        EnumerableSet.AddressSet storage newActiveValidatorsList = _activeValidatorsLists[activeValidatorsListsCount];

        for (index = 0; index < activeValidatorsListCount; index++) {
            newActiveValidatorsList.add(activeValidatorsList.at(index));
        }

        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        if (validator.status != ValidatorStatus.Registered) {
            revert InvalidValidatorStatus();
        }

        newActiveValidatorsList.add(validatorAddress);

        validator.status = ValidatorStatus.Active;
        validator.firstBlockNumber = block.number;

        _epochs[epochsCount].validatorsListId = activeValidatorsListsCount;

        emit ValidatorApproved(validatorAddress);
    }

    /**
     * @notice Deregister validator
     *
     * @param validatorAddress                        validator addresses
     */
    function deregisterValidator(
        address validatorAddress
    ) external override onlyValidatorOwner(validatorAddress) nonReentrant {
        if (_validatorsInfo[validatorAddress].ownerAddress != msg.sender && msg.sender != owner()) {
            revert NotAllowed();
        }

        _deregisterValidator(validatorAddress);

        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        if (validator.grantedAmount == 0) {
            totalStaked -= validator.stakeAmount;
            token.safeTransfer(validator.ownerAddress, validator.stakeAmount);
            validator.stakeAmount = 0;
        }
    }

    /**
     * @notice Deregister validator and withdraw stake amount
     *
     * @param validatorAddress                        validator addresses
     * @param unstakeAmount                           amount to sent to validator owner
     */
    function deregisterValidatorByOwner(
        address validatorAddress,
        uint256 unstakeAmount
    ) external override onlyOwner nonReentrant {
        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        if (unstakeAmount > validator.stakeAmount) {
            revert InvalidStakeAmount();
        }

        if (validator.status == ValidatorStatus.Active || validator.status == ValidatorStatus.Registered) {
            _deregisterValidator(validatorAddress);
        }

        if (validator.status != ValidatorStatus.Deregistered) {
            revert InvalidValidatorStatus();
        }

        uint256 penaltyAmount = validator.stakeAmount - unstakeAmount;

        if (penaltyAmount > 0) {
            token.safeTransfer(owner(), penaltyAmount);
        }

        if (unstakeAmount > 0) {
            token.safeTransfer(validator.ownerAddress, unstakeAmount);
        }

        totalStaked -= validator.stakeAmount;
        validator.stakeAmount = 0;

        emit ValidatorDeregisteredByOwner(validatorAddress, unstakeAmount, penaltyAmount);
    }

    /**
     * @notice Set the master key
     *
     * @param newMasterKey                       new master key
     */
    function setMasterKey(string memory newMasterKey) external override onlyActiveValidators {
        if (bytes(masterKey).length != 0) {
            revert MasterKeyAlreadySet();
        }
        masterKey = newMasterKey;

        emit MasterKeySet(newMasterKey);
    }

    /**
     * @notice Add a file to the pool
     *
     * @param url                                    file url
     * @param encryptedKey                           encrypted key
     */
    function addFile(string memory url, string memory encryptedKey) external override whenNotPaused {
        bytes32 urlHash = keccak256(abi.encodePacked(url));
        if (_fileUrlHashes.contains(urlHash)) {
            revert FileAlreadyAdded();
        }

        _fileUrlHashes.add(urlHash);
        uint256 fileId = _fileUrlHashes.length();

        File storage file = _files[fileId];

        file.ownerAddress = msg.sender;
        file.url = url;
        file.encryptedKey = encryptedKey;
        file.addedTimestamp = block.timestamp;
        file.addedAtBlock = block.number;

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
     * @notice Verify a file
     *
     * @param fileId                             file id
     * @param valid                              whether the file is valid
     * @param score                              score of the verification
     * @param authenticity                       authenticity score
     * @param ownership                          ownership score
     * @param quality                            quality score
     * @param uniqueness                         uniqueness score
     */
    function verifyFile(
        uint256 fileId,
        bool valid,
        uint256 score,
        uint256 authenticity,
        uint256 ownership,
        uint256 quality,
        uint256 uniqueness
    ) external override onlyActiveValidators {
        createEpochs();

        FileResponse memory nextFile = getNextFileToVerify(msg.sender);

        if (nextFile.fileId != fileId) {
            revert InvalidFileId();
        }

        File storage file = _files[fileId];
        if (file.scores[msg.sender].reportedAtBlock != 0) {
            revert FileAlreadyVerified();
        }

        file.scores[msg.sender] = FileScore({
            valid: valid,
            score: score,
            reportedAtBlock: block.number,
            authenticity: authenticity,
            ownership: ownership,
            quality: quality,
            uniqueness: uniqueness
        });

        file.verificationsCount++;

        // Update file's overall scores if this is the first verification
        if (file.verificationsCount == 1) {
            file.valid = valid;
            file.score = score;
            file.authenticity = authenticity;
            file.ownership = ownership;
            file.quality = quality;
            file.uniqueness = uniqueness;
            file.reward = (score * fileRewardFactor) / 1e18;
        } else {
            // Aggregate scores
            file.valid = file.valid && valid;
            file.score = (file.score * (file.verificationsCount - 1) + score) / file.verificationsCount;
            file.authenticity =
                (file.authenticity * (file.verificationsCount - 1) + authenticity) /
                file.verificationsCount;
            file.ownership = (file.ownership * (file.verificationsCount - 1) + ownership) / file.verificationsCount;
            file.quality = (file.quality * (file.verificationsCount - 1) + quality) / file.verificationsCount;
            file.uniqueness = (file.uniqueness * (file.verificationsCount - 1) + uniqueness) / file.verificationsCount;
            file.reward = (file.score * fileRewardFactor) / 1e18;
        }

        // Update the last verified file for this validator
        ValidatorInfo storage validator = _validatorsInfo[msg.sender];
        if (fileId > validator.lastVerifiedFile) {
            validator.lastVerifiedFile = fileId;
        }

        if (file.verificationsCount > _activeValidatorsLists[activeValidatorsListsCount].length() / 2) {
            file.finalized = true;
            lastFinalizedFileId = fileId;
        }

        emit FileVerified(msg.sender, fileId, score);
    }

    /**
     * @notice Create epochs
     * used when the last epoch has ended
     */
    function createEpochs() public override {
        createEpochsUntilBlockNumber(block.number);
    }

    /**
     * @notice Create epochs
     * used when the last epoch has ended
     */
    function createEpochsUntilBlockNumber(uint256 blockNumber) public override {
        Epoch storage lastEpoch = _epochs[epochsCount];

        if (lastEpoch.endBlock >= blockNumber) {
            return;
        }

        uint256 epochCountTemp = epochsCount;

        while (lastEpoch.endBlock < blockNumber) {
            _setEmissionScores(epochCountTemp);
            epochCountTemp++;
            Epoch storage newEpoch = _epochs[epochCountTemp];

            newEpoch.validatorsListId = lastEpoch.validatorsListId;
            newEpoch.startBlock = lastEpoch.endBlock + 1;
            newEpoch.endBlock = newEpoch.startBlock + epochSize - 1;
            newEpoch.reward = epochRewardAmount;

            lastEpoch = newEpoch;

            emit EpochCreated(epochCountTemp);
        }

        epochsCount = epochCountTemp;
    }

    /**
     * @notice Set the weights for the validators
     */
    function updateWeights(
        address[] memory validators,
        uint256[] memory weights
    ) external override onlyActiveValidators {
        createEpochs();

        uint256 length = validators.length;

        if (length != weights.length) {
            revert ArityMismatch();
        }

        ValidatorInfo storage validator = _validatorsInfo[msg.sender];

        for (uint256 i = 0; i < weights.length; i++) {
            validator.weights[validators[i]] = weights[i];
        }

        emit WeightsUpdated(msg.sender, validators, weights);
    }

    /**
     * @notice Add rewards for validators
     */
    function addRewardForValidators(uint256 validatorsRewardAmount) external override nonReentrant {
        token.safeTransferFrom(msg.sender, address(this), validatorsRewardAmount);
        totalValidatorsRewardAmount += validatorsRewardAmount;
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

        if (file.ownerAddress != msg.sender) {
            revert NotFileOwner();
        }

        if (!file.finalized) {
            revert NotFinalized();
        }

        if (
            file.rewardWithdrawn > 0 ||
            file.addedTimestamp + fileRewardDelay > block.timestamp ||
            totalContributorsRewardAmount < file.reward
        ) {
            revert WithdrawNotAllowed();
        }

        file.rewardWithdrawn = file.reward;
        token.safeTransfer(msg.sender, file.reward);

        emit ContributionRewardClaimed(msg.sender, fileId, file.reward);
    }

    function claimUnsentReward(
        address validatorAddress,
        uint256 epochNumber
    ) external override onlyValidatorOwner(validatorAddress) {
        Epoch storage epoch = _epochs[epochNumber];
        ValidatorReward storage validatorReward = epoch.validatorRewards[validatorAddress];

        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        uint256 validatorRewardAmount = (validatorReward.score * epoch.reward) / 1e18;

        if (validatorRewardAmount <= validatorReward.withdrawnAmount) {
            revert NothingToClaim();
        }

        uint256 unclaimedReward = validatorRewardAmount - validatorReward.withdrawnAmount;

        if (totalValidatorsRewardAmount > unclaimedReward) {
            epoch.validatorRewards[validatorAddress].withdrawnAmount = validatorRewardAmount;
            totalValidatorsRewardAmount -= unclaimedReward;
            token.safeTransfer(validator.ownerAddress, unclaimedReward);

            emit EpochRewardClaimed(validatorAddress, epochNumber, unclaimedReward);
        }
    }

    /**
     * @notice Set the emission scores for the validators
     * Approximate sigmoid function using rational approximation and WAD
     * Modeled after https://bittensor.com/whitepaper
     * Designed via https://www.desmos.com/calculator/npx9o19sre
     *
     * @param xWAD                               trust score
     * @param aWAD                               amplitude
     * @param pWAD                               temperature
     * @param kWAD                               shift
     * @param cWAD                               steepness
     */
    function rationalSigmoid(
        uint256 xWAD,
        uint256 aWAD,
        uint256 pWAD,
        uint256 kWAD,
        uint256 cWAD
    ) public pure returns (uint256) {
        // This will help us determine which version of the sigmoid function to use, to ensure we never use negative values
        bool aboveTrustThreshold = xWAD > kWAD;

        // ---- Calculate (x - k) * WAD ----
        // Start with xWAD and kWAD: x * WAD - k * WAD = (x - k) * WAD
        uint256 shiftWAD = aboveTrustThreshold ? xWAD - kWAD : kWAD - xWAD;

        // ---- Calculate (x - k)^2 * WAD ----
        // Start with shiftWAD:
        // (x - k) * WAD * (x - k) * WAD = (x - k)^2 * WAD^2
        // Normalize by dividing by WAD: (x - k)^2 * WAD^2 / WAD = (x - k)^2 * WAD
        uint256 shiftSquaredWAD = (shiftWAD * shiftWAD) / 1e18;

        // ---- Calculate p * (x - k) * WAD ----
        // Start with pWAD and shiftWAD:
        // p * WAD * (x - k) * WAD = p * (x - k) * WAD^2
        // Normalize by dividing by WAD: p * (x - k) * WAD^2 / WAD = p * (x - k) * WAD
        uint256 numeratorWAD = (pWAD * shiftWAD) / 1e18;

        // ---- Calculate sqrt(c + p * (x - k)^2) * WAD ----
        // Start with cWAD, pWAD, and shiftSquaredWAD:
        // sqrt(c * WAD + p * WAD * (x - k)^2 * WAD)
        // Normalize by dividing right-hand side of addition by WAD:
        // sqrt(c * WAD + p * WAD * (x - k)^2)
        // Factor out WAD: sqrt(WAD * (c + p * (x - k)^2))
        // Multiply by sqrt(WAD): sqrt(WAD) * sqrt(c + p * (x - k)^2) = WAD * sqrt(c + p * (x - k)^2)
        // uint256 denominatorWAD = (WAD.sqrt()).mul(cWAD.add(pWAD.mul(shiftSquaredWAD).div(WAD)).sqrt());

        uint256 denominatorWAD = Math.sqrt(1e18) * Math.sqrt(cWAD + (pWAD * shiftSquaredWAD) / 1e18);

        // ---- Calculate a * (p * (x - k) / sqrt(c + p * (x - k)^2) + 1) * WAD ----
        // Start with aWAD, numeratorWAD, and denominatorWAD:
        // a * WAD * (p * (x - k) * WAD) / (sqrt(c + p * (x - k)^2) * WAD) + a * WAD
        // Simplify: a * WAD * (p * (x - k) / sqrt(c + p * (x - k)^2) + 1)
        if (aboveTrustThreshold) {
            return (aWAD * numeratorWAD) / denominatorWAD + aWAD;
        } else {
            return 1e18 - ((aWAD * numeratorWAD) / denominatorWAD + aWAD);
        }
    }

    /**
     * @notice Set the emission scores for the validators
     *
     * @param S                                   stake amounts
     */
    function _normalizeStakes(uint256[] memory S) internal pure returns (uint256[] memory) {
        uint256 total = 0;
        uint256[] memory normalized = new uint256[](S.length);

        for (uint256 i = 0; i < S.length; i++) {
            total = total + S[i];
        }

        require(total > 0, "Division by zero in normalizeStakes");

        for (uint256 j = 0; j < S.length; j++) {
            normalized[j] = (S[j] * 1e18) / total;
        }

        return normalized;
    }

    /**
     * @notice Calculate the trust scores for the validators
     *
     * @param W                                   weights
     * @param S                                   stake amounts
     */
    function _calculateTrust(uint256[][] memory W, uint256[] memory S) internal view returns (uint256[] memory) {
        uint256[] memory T = new uint256[](W.length);

        for (uint256 i = 0; i < W.length; i++) {
            for (uint256 j = 0; j < W[i].length; j++) {
                if (W[i][j] > validatorScoreMinTrust) {
                    T[j] = T[j] + (W[i][j] * S[i]) / 1e18;
                }
            }
        }

        return T;
    }

    /**
     * @notice Calculate the rank scores for the validators
     *
     * @param W                                   weights
     * @param S                                   stake amounts
     */
    function calculateRank(uint256[][] memory W, uint256[] memory S) internal pure returns (uint256[] memory) {
        uint256[] memory R = new uint256[](W.length);
        uint256 totalScore = 0;

        for (uint256 i = 0; i < W.length; i++) {
            for (uint256 j = 0; j < W[i].length; j++) {
                R[j] = R[j] + (W[i][j] * S[i]) / 1e18;
            }
        }

        for (uint256 k = 0; k < R.length; k++) {
            totalScore = totalScore + R[k];
        }

        if (totalScore == 0) {
            return new uint256[](R.length);
        }

        // require(totalScore > 0, "Division by zero in calculateRank");

        for (uint256 l = 0; l < R.length; l++) {
            R[l] = (R[l] * 1e18) / totalScore;
        }

        return R;
    }

    /**
     * @notice Calculate the consensus scores for the validators
     *
     * @param T                                   trust scores
     */
    function calculateConsensus(uint256[] memory T) internal view returns (uint256[] memory) {
        uint256[] memory C = new uint256[](T.length);

        // Sigmoid amplitude, hardcode to a = 0.5
        uint256 aWAD = 5e17;
        // Sigmoid temperature
        uint256 pWAD = validatorScoreRho;
        // Sigmoid shift (midpoint)
        uint256 kWAD = validatorScoreKappa;
        // Sigmoid steepness, hardcode to c = 0.025
        // Equivalent to uint256(25).mul(1e15)
        uint256 cWAD = 25e15;

        for (uint256 i = 0; i < T.length; i++) {
            C[i] = rationalSigmoid(T[i], aWAD, pWAD, kWAD, cWAD);
        }

        return C;
    }

    /**
     * @notice Calculate the emissions for the validators
     *
     * @param C                                   consensus scores
     * @param R                                   rank scores
     */
    function _calculateEmissions(uint256[] memory C, uint256[] memory R) internal pure returns (uint256[] memory) {
        uint256[] memory E = new uint256[](C.length);
        uint256 totalEmissions = 0;

        for (uint256 i = 0; i < C.length; i++) {
            E[i] = (C[i] * R[i]) / 1e18;
            totalEmissions = totalEmissions + E[i];
        }

        if (totalEmissions == 0) {
            return new uint256[](E.length);
        }

        // require(totalEmissions > 0, "Division by zero in calculateEmissions");

        for (uint256 j = 0; j < E.length; j++) {
            E[j] = (E[j] * 1e18) / totalEmissions;
        }

        return E;
    }

    /**
     * @notice Get the emission scores for the validators
     *
     * @param epochNumber                   epoch number
     */
    function getEmissionScores(uint256 epochNumber) public view override returns (uint256[] memory) {
        EnumerableSet.AddressSet storage epochValidators = _activeValidatorsLists[
            _epochs[epochNumber].validatorsListId
        ];

        uint256 epochValidatorsCount = epochValidators.length();

        uint256[] memory S = new uint256[](epochValidatorsCount);

        bool hasAnyStake = false;
        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            S[i] = _validatorsInfo[epochValidators.at(i)].stakeAmount;
            if (!hasAnyStake && S[i] > 0) {
                hasAnyStake = true;
            }
        }

        if (!hasAnyStake) {
            return new uint256[](epochValidatorsCount);
        }

        uint256[][] memory W = new uint256[][](epochValidatorsCount);
        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            W[i] = new uint256[](epochValidatorsCount);

            ValidatorInfo storage validator = _validatorsInfo[epochValidators.at(i)];

            for (uint256 j = 0; j < epochValidatorsCount; j++) {
                W[i][j] = validator.weights[epochValidators.at(j)];
            }
        }

        uint256[] memory normalizedStakes = _normalizeStakes(S);
        uint256[] memory T = _calculateTrust(W, normalizedStakes);
        uint256[] memory R = calculateRank(W, normalizedStakes);
        uint256[] memory C = calculateConsensus(T);
        return _calculateEmissions(C, R);
    }

    /**
     * @notice Set the emission scores for the validators
     *
     * @param epochNumber                   epoch number
     */
    function _setEmissionScores(uint256 epochNumber) internal {
        EnumerableSet.AddressSet storage epochValidators = _activeValidatorsLists[
            _epochs[epochNumber].validatorsListId
        ];

        uint256 epochValidatorsCount = epochValidators.length();

        uint256[] memory scores = getEmissionScores(epochNumber);

        Epoch storage epoch = _epochs[epochNumber];
        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            address validatorAddress = epochValidators.at(i);
            uint256 validatorReward = (scores[i] * epoch.reward) / 1e18;

            ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

            epoch.validatorRewards[validatorAddress].score = scores[i];

            //send the reward to the validator
            if (validatorReward > 0 && totalValidatorsRewardAmount > validatorReward) {
                epoch.validatorRewards[validatorAddress].withdrawnAmount = validatorReward;
                totalValidatorsRewardAmount -= validatorReward;
                token.safeTransfer(validator.ownerAddress, validatorReward);
            }
        }
    }
    function _deregisterValidator(address validatorAddress) internal {
        createEpochs();

        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        if (validator.status != ValidatorStatus.Registered && validator.status != ValidatorStatus.Active) {
            revert InvalidValidatorStatus();
        }

        uint256 index;

        EnumerableSet.AddressSet storage currentList = _activeValidatorsLists[activeValidatorsListsCount];
        uint256 currentListCount = currentList.length();

        activeValidatorsListsCount++;

        EnumerableSet.AddressSet storage newList = _activeValidatorsLists[activeValidatorsListsCount];

        for (index = 0; index < currentListCount; index++) {
            if (currentList.at(index) != validatorAddress) {
                newList.add(currentList.at(index));
            }
        }

        _epochs[epochsCount].validatorsListId = activeValidatorsListsCount;

        validator.status = ValidatorStatus.Deregistered;
        validator.lastBlockNumber = block.number;

        emit ValidatorDeregistered(validatorAddress);
    }
}
