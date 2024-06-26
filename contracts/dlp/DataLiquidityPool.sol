// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/DataLiquidityPoolStorageV1.sol";

import "hardhat/console.sol";

contract DataLiquidityPool is
    UUPSUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    DataLiquidityPoolStorageV1
{
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    using SafeERC20 for IERC20;

    /**
     * @notice Triggered when a validator has staked some DAT
     *
     * @param validatorAddress                   address of the validator
     * @param amount                             amount staked in this call
     * @param totalAmount                        total amount staked by the validator
     */
    event Staked(
        address indexed validatorAddress,
        uint256 amount,
        uint256 totalAmount
    );
    /**
     * @notice Triggered when a validator has unstaked some DAT
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
    event ValidatorRegistered(
        address indexed validatorAddress,
        address indexed ownerAddress,
        uint256 amount
    );

    /**
     * @notice Triggered when a validator has been unregistered
     *
     * @param validatorAddress                   address of the validator
     */
    event ValidatorUnregisterd(address indexed validatorAddress);

    /**
     * @notice Triggered when a validator has been approved
     *
     * @param validatorAddress                   address of the validator
     */
    event ValidatorApproved(address indexed validatorAddress);

    /**
     * @notice Triggered when a validator has been inactivated
     *
     * @param validatorAddress                   address of the validator
     */
    event ValidatorInactivated(address indexed validatorAddress);

    /**
     * @notice Triggered when a validator has been deregistered
     *
     * @param validatorAddress                   address of the validator
     */
    event ValidatorDeregistered(address indexed validatorAddress);

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
    event FileVerified(
        address indexed validatorAddress,
        uint256 fileId,
        uint256 score
    );

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
    event WeightsUpdated(
        address indexed validatorAddress,
        address[] validators,
        uint256[] weights
    );

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
    event ContributionRewardClaimed(
        address indexed contributorAddress,
        uint256 fileId,
        uint256 amount
    );

    error InvalidStakeAmount();
    error InvalidValidatorStatus(uint256 reuired, uint256 current);
    error TooManyValidators();
    error NotValidatorOwner();
    error WithdrawNotAllowed();
    error MasterKeyAlreadySet();
    error FileAlreadyAdded();
    error FileAlreadyVerified();
    error InvalidFileId();
    error ArityMismatch();
    error NotFileOwner();
    error FileNotVerified();
    error VerificationDeadlineExceeded();
    error ValidatorAlreadyVerified();

    /**
     * @dev Modifier to make a function callable only when the caller is an active validator
     */
    modifier onlyActiveValidators() {
        if (_validatorsInfo[msg.sender].status != ValidatorStatus.Active) {
            revert InvalidValidatorStatus(
                uint256(ValidatorStatus.Active),
                uint256(_validatorsInfo[msg.sender].status)
            );
        }
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the caller is the cold key of the validator
     *
     * @param validatorAddress                         address of the validator
     */
    modifier onlyValidatorOwner(address validatorAddress) {
        if (_validatorsInfo[validatorAddress].ownerAddress != msg.sender) {
            revert NotValidatorOwner();
        }
        _;
    }

    /**
     * @notice Initialize the contract
     *
     * @param ownerAddress                       owner of the contract
     * @param newMaxNumberOfValidators           maximum number of validators
     * @param newValidatorScoreMinTrust          minimum trust score
     * @param newValidatorScoreKappa             trust score kappa
     * @param newValidatorScoreRho               trust score rho
     * @param newValidationPeriod                validation period
     * @param newMinStakeAmount                  minimum stake amount
     * @param startBlock                         start block
     * @param newEpochSize                       epoch size size
     * @param newEpochRewardAmount               reward amount
     * @param newFileRewardDelay                 file reward delay

     */
    function initialize(
        address ownerAddress,
        address tokenAddress,
        uint256 newMaxNumberOfValidators,
        uint256 newValidatorScoreMinTrust,
        uint256 newValidatorScoreKappa,
        uint256 newValidatorScoreRho,
        uint256 newValidationPeriod,
        uint256 newMinStakeAmount,
        uint256 startBlock,
        uint256 newEpochSize,
        uint256 newEpochRewardAmount,
        uint256 newFileRewardFactor,
        uint256 newFileRewardDelay
    ) external initializer {
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        maxNumberOfValidators = newMaxNumberOfValidators;
        validatorScoreMinTrust = newValidatorScoreMinTrust;
        validatorScoreKappa = newValidatorScoreKappa;
        validatorScoreRho = newValidatorScoreRho;
        minStakeAmount = newMinStakeAmount;
        validationPeriod = newValidationPeriod;
        epochSize = newEpochSize;
        epochRewardAmount = newEpochRewardAmount;
        token = IERC20(tokenAddress);
        fileRewardFactor = newFileRewardFactor;
        fileRewardDelay = newFileRewardDelay;

        epochsCount = 1;

        _validatorsWithFilesToVerify.add(address(0));

        Epoch storage firstEpoch = _epochs[1];
        firstEpoch.startBlock = startBlock;
        firstEpoch.endBlock = startBlock + newEpochSize - 1;
        firstEpoch.reward = newEpochRewardAmount;

        emit EpochCreated(1);

        _transferOwnership(ownerAddress);
    }

    /**
     * @notice Upgrade the contract
     * This function is required by OpenZeppelin's UUPSUpgradeable
     *
     * @param newImplementation                  new implementation
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * return the veriosn of the contract
     */
    function version() external pure returns (uint256) {
        return 1;
    }

    /**
     * @notice Get the number of files
     */
    function filesCount() external view returns (uint256) {
        // TODO: fix spelling
        return _fileUrlHases.length();
    }

    /**
     * @notice Get the file information
     *
     * @param fileId                              file id
     */
    function files(
        uint256 fileId
    ) public view override returns (FileResponse memory) {
        return FileResponse(
            fileId,
            _files[fileId].contributorAddress,
            _files[fileId].url,
            _files[fileId].encryptedKey,
            _files[fileId].addedAt,
            _files[fileId].reward,
            _files[fileId].rewardWithdrawn,
            _files[fileId].verificationsCount,
            _files[fileId].isVerified
        );
    }

    /**
     * @notice Get the file verification for a specific validator
     * @param fileId The ID of the file
     * @param validatorAddress The address of the validator
     * @return FileVerificationInfo The verification information
     */
    function fileVerifications(
        uint256 fileId,
        address validatorAddress
    )
    external
    view
    override
    returns (
        FileVerificationInfo memory
    )
    {
        return _files[fileId].verifications[validatorAddress];
    }

    /**
     * @notice Get the contributor information
     *
     * @param index                   index of the contributor
     * @return ContributorInfoResponse             contributor information
     */
    function contributors(
        uint256 index
    ) external view returns (ContributorInfoResponse memory) {
        return contributorInfo(_contributors[index]);
    }

    /**
     * @notice Get the contributor information
     *
     * @param contributorAddress                   address of the contributor
     * @return ContributorInfoResponse             contributor information
     */
    function contributorInfo(
        address contributorAddress
    ) public view returns (ContributorInfoResponse memory) {
        return
            ContributorInfoResponse(
                contributorAddress,
                _contributorInfo[contributorAddress].fileIdsCount
            );
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
    ) external view returns (FileResponse memory) {
        return files(_contributorInfo[contributorAddress].fileIds[index]);
    }

    /**
     * @notice Get the validator information
     *
     * @param index                         index of the validator
     */
    function validators(
        uint256 index
    ) external view override returns (ValidatorInfoResponse memory) {
        return validatorsInfo(_validators[index]);
    }

    /**
     * @notice Get the validator information
     *
     * @param validatorAddress                         address of the validator
     */
    function validatorsInfo(
        address validatorAddress
    ) public view override returns (ValidatorInfoResponse memory) {
        return
            ValidatorInfoResponse(
                validatorAddress,
                _validatorsInfo[validatorAddress].ownerAddress,
                _validatorsInfo[validatorAddress].stakeAmount,
                _validatorsInfo[validatorAddress].status,
                _validatorsInfo[validatorAddress].firstBlockNumber,
                _validatorsInfo[validatorAddress].lastBlockNumber,
                _validatorsInfo[validatorAddress].grantedAmount,
                _validatorsInfo[validatorAddress].filesToVerifyIndex,
                _validatorsInfo[validatorAddress].filesToVerifyCount
            );
    }

    function validatorsWithFilesToVerify()
        external
        view
        returns (address[] memory)
    {
        return _validatorsWithFilesToVerify.values();
    }


    /**
     * @notice Get the next file to verify for any validator
     * @return NextFileToVerify struct containing file information
     */
    function getNextFileToVerify() public view returns (NextFileToVerify memory) {
        File storage file = _files[nextFileToVerifyId];
        if (nextFileToVerifyId > 0 && !verifiedFiles[nextFileToVerifyId] && block.timestamp >= file.addedAt + validationPeriod) {
            return NextFileToVerify(
                nextFileToVerifyId,
                file.url,
                file.encryptedKey,
                file.addedAt
            );
        }
        return NextFileToVerify(0, "", "", 0);
    }

    /**
     * @notice Get epoch information
     *
     * @param epochId                         epoch id
     */
    function epochs(
        uint256 epochId
    )
        external
        view
        returns (
            uint256 startBlock,
            uint256 endBlock,
            uint256 reward,
            uint256 validatorsListId
        )
    {
        return (
            _epochs[epochId].startBlock,
            _epochs[epochId].endBlock,
            _epochs[epochId].reward,
            _epochs[epochId].validatorsListId
        );
    }

    /**
     * @notice Get active validator list by listId
     */
    function activeValidatorsLists(
        uint256 id
    ) public view override returns (address[] memory) {
        return _activeValidatorsLists[id].values();
    }

    /**
     * @notice Get the epoch rewards
     *
     * @param epochId                              epoch id
     *
     * @return validators                          validators
     * @return shares                              rewards
     */
    function epochRewards(
        uint256 epochId
    )
        external
        view
        returns (
            address[] memory validators,
            uint256[] memory shares,
            uint256[] memory withdrawnAmounts
        )
    {
        EnumerableSet.AddressSet
            storage epochValidators = _activeValidatorsLists[
                _epochs[epochId].validatorsListId
            ];

        uint256 epochValidatorsCount = epochValidators.length();

        validators = new address[](epochValidatorsCount);
        shares = new uint256[](epochValidatorsCount);
        withdrawnAmounts = new uint256[](epochValidatorsCount);

        Epoch storage epoch = _epochs[epochId];

        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            validators[i] = epochValidators.at(i);
            shares[i] = epoch.validatorRewards[validators[i]].share;
            withdrawnAmounts[i] = epoch
                .validatorRewards[validators[i]]
                .withdrawnAmount;
        }
    }

    /**
     * @notice Get weights assigned by the validator
     */
    function validatorWeights(
        address validatorAddress
    )
        external
        view
        returns (address[] memory validators, uint256[] memory weights)
    {
        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        EnumerableSet.AddressSet
            storage epochValidators = _activeValidatorsLists[
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
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @notice Update the maximum number of validators
     *
     * @param newMaxNumberOfValidators           new maximum number of validators
     */
    function updateMaxNumberOfValidators(
        uint256 newMaxNumberOfValidators
    ) external override onlyOwner {
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
    function updateEpochRewardAmount(
        uint256 newEpochRewardAmount
    ) external override onlyOwner {
        createEpochs();
        epochRewardAmount = newEpochRewardAmount;

        emit EpochRewardAmountUpdated(newEpochRewardAmount);
    }

    /**
     * @notice Update the fileRewardFactor
     *
     * @param newFileRewardFactor                new file reward factor
     */
    function updateFileRewardFactor(
        uint256 newFileRewardFactor
    ) external override onlyOwner {
        fileRewardFactor = newFileRewardFactor;

        emit FileRewardFactorUpdated(newFileRewardFactor);
    }

    /**
     * @notice Update the fileRewardDelay
     *
     * @param newFileRewardDelay                new file reward delay
     */
    function updateFileRewardDelay(
        uint256 newFileRewardDelay
    ) external override onlyOwner {
        fileRewardDelay = newFileRewardDelay;

        emit FileRewardDelayUpdated(newFileRewardDelay);
    }

    /**
     * @notice Update the validation period
     *
     * @param newValidationPeriod                new validation period
     */
    function updateValidationPeriod(
        uint256 newValidationPeriod
    ) external onlyOwner {
        validationPeriod = newValidationPeriod;

        emit ValidationPeriodUpdated(newValidationPeriod);
    }

    /**
     * @notice Update the validatorScoreMinTrust
     *
     * @param newValidatorScoreMinTrust                new validatorScoreMinTrust
     */
    function updateValidatorScoreMinTrust(
        uint256 newValidatorScoreMinTrust
    ) external onlyOwner {
        validatorScoreMinTrust = newValidatorScoreMinTrust;

        emit ValidatorScoreMinTrustUpdated(newValidatorScoreMinTrust);
    }

    /**
     * @notice Update the validatorScoreKappa
     *
     * @param newValidatorScoreKappa                new validatorScoreKappa
     */
    function updateValidatorScoreKappa(
        uint256 newValidatorScoreKappa
    ) external onlyOwner {
        validatorScoreKappa = newValidatorScoreKappa;

        emit ValidatorScoreKappaUpdated(newValidatorScoreKappa);
    }

    /**
     * @notice Update the validatorScoreRho
     *
     * @param newValidatorScoreRho                new validatorScoreRho
     */
    function updateValidatorScoreRho(
        uint256 newValidatorScoreRho
    ) external onlyOwner {
        validatorScoreRho = newValidatorScoreRho;

        emit ValidatorScoreRhoUpdated(newValidatorScoreRho);
    }

    /**
     * @notice Update the minStakeAmount
     *
     * @param newMinStakeAmount                new minStakeAmount
     */
    function updateMinStakeAmount(
        uint256 newMinStakeAmount
    ) external onlyOwner {
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
            revert InvalidValidatorStatus(
                uint256(ValidatorStatus.None),
                uint256(validator.status)
            );
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

        emit ValidatorRegistered(
            validatorAddress,
            validatorOwnerAddress,
            stakeAmount
        );
    }

    function approveValidator(address validatorAddress) public onlyOwner {
        createEpochs();
        uint256 index;

        EnumerableSet.AddressSet
            storage activeValidatorsList = _activeValidatorsLists[
                activeValidatorsListsCount
            ];
        uint256 activeValidatorsListCount = activeValidatorsList.length();

        activeValidatorsListsCount++;

        EnumerableSet.AddressSet
            storage newActiveValidatorsList = _activeValidatorsLists[
                activeValidatorsListsCount
            ];

        for (index = 0; index < activeValidatorsListCount; index++) {
            newActiveValidatorsList.add(activeValidatorsList.at(index));
        }

        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        if (validator.status != ValidatorStatus.Registered) {
            revert InvalidValidatorStatus(
                uint256(ValidatorStatus.Registered),
                uint256(validator.status)
            );
        }

        newActiveValidatorsList.add(validatorAddress);
        _validatorsWithFilesToVerify.add(validatorAddress);

        validator.status = ValidatorStatus.Active;
        validator.firstBlockNumber = block.number;

        _epochs[epochsCount].validatorsListId = activeValidatorsListsCount;

        emit ValidatorApproved(validatorAddress);
    }

    /**
     * @notice Approve validator
     *
     * @param validatorAddress                        validator addresses
     */
    function inactivateValidator(
        address validatorAddress
    ) public onlyValidatorOwner(validatorAddress) {
        createEpochs();

        if (
            _validatorsInfo[validatorAddress].status != ValidatorStatus.Active
        ) {
            revert InvalidValidatorStatus(
                uint256(ValidatorStatus.Active),
                uint256(_validatorsInfo[validatorAddress].status)
            );
        }

        _inactivateValidator(validatorAddress);
    }

    /**
     * @notice Deregister validator and withdraw stake amount
     *
     * @param validatorAddress                        validator addresses
     */
    function deregisterValidator(
        address validatorAddress
    ) external onlyValidatorOwner(validatorAddress) nonReentrant {
        createEpochs();

        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        if (validator.grantedAmount > 0) {
            revert WithdrawNotAllowed();
        }

        if (validator.status == ValidatorStatus.Active) {
            _inactivateValidator(validatorAddress);
        } else if (
            validator.status != ValidatorStatus.Registered &&
            validator.status != ValidatorStatus.Inactive
        ) {
            revert InvalidValidatorStatus(
                uint256(ValidatorStatus.Inactive),
                uint256(validator.status)
            );
        }

        validator.status = ValidatorStatus.Deregistered;
        totalStaked -= validator.stakeAmount;

        token.safeTransfer(validator.ownerAddress, validator.stakeAmount);

        emit ValidatorDeregistered(validatorAddress);
    }

    /**
     * @notice Deregister validator and withdraw stake amount
     *
     * @param validatorAddress                        validator addresses
     * @param validatorAmount                         amount to withdraw
     */
    function deregisterValidatorByOwner(
        address validatorAddress,
        uint256 validatorAmount
    ) external onlyOwner {
        createEpochs();

        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        if (validator.status == ValidatorStatus.Active) {
            _inactivateValidator(validatorAddress);
        } else if (
            validator.status != ValidatorStatus.Registered &&
            validator.status != ValidatorStatus.Inactive
        ) {
            revert InvalidValidatorStatus(
                uint256(ValidatorStatus.Inactive),
                uint256(validator.status)
            );
        }

        validator.status = ValidatorStatus.Deregistered;

        if (validatorAmount < validator.stakeAmount) {
            token.safeTransfer(validator.ownerAddress, validatorAmount);
            token.safeTransfer(
                owner(),
                validator.stakeAmount - validatorAmount
            );
        } else {
            token.safeTransfer(validator.ownerAddress, validator.stakeAmount);
        }

        totalStaked -= validator.stakeAmount;

        emit ValidatorDeregistered(validatorAddress);
    }

    /**
     * @notice Set the master key
     *
     * @param newMasterKey                       new master key
     */
    function setMasterKey(
        string memory newMasterKey
    ) external onlyActiveValidators {
        if (bytes(masterKey).length != 0) {
            revert MasterKeyAlreadySet();
        }
        masterKey = newMasterKey;

        emit MasterKeySet(newMasterKey);
    }


    /**
     * @notice Add a file to the pool
     * @param url File URL
     * @param encryptedKey Encrypted key for the file
     */
    function addFile(string memory url, string memory encryptedKey) external whenNotPaused {
        createEpochs();
        bytes32 urlHash = keccak256(abi.encodePacked(url));
        require(!_fileUrlHases.contains(urlHash), "FileAlreadyAdded");

        _fileUrlHases.add(urlHash);
        uint256 filesId = _fileUrlHases.length();

        File storage file = _files[filesId];

        file.contributorAddress = msg.sender;
        file.url = url;
        file.encryptedKey = encryptedKey;
        file.addedAt = block.timestamp;
        file.addedAtBlock = block.number;
        file.isVerified = false;

        if (nextFileToVerifyId == 0) {
            nextFileToVerifyId = filesId;
        }
        lastAddedFileId = filesId;

        ContributorInfo storage contributor = _contributorInfo[msg.sender];
        contributor.fileIdsCount++;
        contributor.fileIds[contributor.fileIdsCount] = filesId;

        emit FileAdded(msg.sender, filesId);
    }

    /**
     * @notice Find the next unverified file ID
     * @param startId The ID to start searching from
     * @param endId The ID to end searching at
     * @return The ID of the next unverified file, or 0 if none found
     */
    function findNextUnverifiedFile(uint256 startId, uint256 endId) internal view returns (uint256) {
        for (uint256 i = startId; i <= endId; i++) {
            if (!verifiedFiles[i] && _files[i].addedAt > 0) {
                return i;
            }
        }
        return 0; // No more files to verify
    }

    /**
     * @notice Verify a file and update its scores
     * @param fileId The ID of the file to verify
     * @param score The overall score given by the validator
     * @param authenticity The authenticity score
     * @param ownership The ownership score
     * @param quality The quality score
     * @param uniqueness The uniqueness score
     * @param metadata Additional metadata about the verification
     */
    function verifyFile(
        uint256 fileId,
        uint256 score,
        uint256 authenticity,
        uint256 ownership,
        uint256 quality,
        uint256 uniqueness,
        string memory metadata
    ) external onlyActiveValidators {
        createEpochs();

        File storage file = _files[fileId];
        require(file.addedAt > 0, "Invalid fileId");
        require(block.timestamp >= file.addedAt + validationPeriod, "Validation period not yet elapsed");

        FileVerificationInfo storage verification = file.verifications[msg.sender];
        require(verification.reportedAt == 0, "File already verified by this validator");

        verification.validatorAddress = msg.sender;
        verification.reportedAt = block.timestamp;
        verification.reportedAtBlock = block.number;
        verification.score = score;
        verification.authenticity = authenticity;
        verification.ownership = ownership;
        verification.quality = quality;
        verification.uniqueness = uniqueness;
        verification.metadata = metadata;

        file.verificationsCount++;

        // Update overall scores
        updateOverallScores(fileId);

        // Only set the reward if the file is considered valid
        if (file.isVerified) {
            file.reward = score * fileRewardFactor / 1e18;
        }

        // Update nextFileToVerifyId if the current file is verified
        if (file.isVerified) {
            verifiedFiles[fileId] = true;
            if (fileId == nextFileToVerifyId) {
                nextFileToVerifyId = findNextUnverifiedFile(fileId + 1, lastAddedFileId);
            }
        }

        emit FileVerified(msg.sender, fileId, score);
    }

    function getFileVerification(uint256 fileId, address validatorAddress) public view returns (FileVerificationInfo memory) {
        return _files[fileId].verifications[validatorAddress];
    }

    /**
     * @notice Update overall scores for a file
     * @param fileId The ID of the file to update
     */
    function updateOverallScores(uint256 fileId) internal {
        File storage file = _files[fileId];
        uint256 totalScore = 0;
        uint256 totalAuthenticity = 0;
        uint256 totalOwnership = 0;
        uint256 totalQuality = 0;
        uint256 totalUniqueness = 0;

        address[] memory activeValidators = getActiveValidators();
        uint256 verificationCount = 0;

        for (uint256 i = 0; i < activeValidators.length; i++) {
            FileVerificationInfo storage verification = file.verifications[activeValidators[i]];
            if (verification.reportedAt > 0) {
                totalScore += verification.score;
                totalAuthenticity += verification.authenticity;
                totalOwnership += verification.ownership;
                totalQuality += verification.quality;
                totalUniqueness += verification.uniqueness;
                verificationCount++;
            }
        }

        if (verificationCount > 0) {
            file.overallScore = totalScore / verificationCount;
            file.authenticity = totalAuthenticity / verificationCount;
            file.ownership = totalOwnership / verificationCount;
            file.quality = totalQuality / verificationCount;
            file.uniqueness = totalUniqueness / verificationCount;

            // Set isVerified to true only if there's a majority and the overall score is above a threshold
            uint256 scoreThreshold = 5e17; // 0.5 in WAD format
            if (verificationCount > activeValidators.length / 2 && file.overallScore >= scoreThreshold) {
                file.isVerified = true;
            }
        }
    }

    /** @notice Calculates the reward for a verified file
     * @param file The File struct of the verified file
     * @return The calculated reward
     */
    function calculateFileReward(File storage file) internal view returns (uint256) {
        uint256 totalScore = 0;
        uint256 validVerifications = 0;

        address[] memory activeValidators = _activeValidatorsLists[activeValidatorsListsCount].values();

        for (uint256 i = 0; i < activeValidators.length; i++) {
            FileVerificationInfo storage verification = file.verifications[activeValidators[i]];
            if (verification.reportedAt != 0) {
                totalScore += verification.score;
                validVerifications++;
            }
        }

        if (validVerifications == 0) {
            return 0;
        }

        uint256 averageScore = totalScore / validVerifications;
        return averageScore * fileRewardFactor / 1e18;
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
    ) external onlyActiveValidators {
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
    function addRewardForValidators(
        uint256 validatorsRewardAmount
    ) external nonReentrant {
        token.safeTransferFrom(msg.sender, address(this), validatorsRewardAmount);
        totalValidatorsRewardAmount += validatorsRewardAmount;
    }

    /**
     * @notice Add rewards for contributors
     */
    function addRewardsForContributors(
        uint256 contributorsRewardAmount
    ) external nonReentrant {
        token.safeTransferFrom(msg.sender, address(this), contributorsRewardAmount);
        totalContributorsRewardAmount += contributorsRewardAmount;
    }

    function claimContributionReward(uint256 fileId) external {
        File storage file = _files[fileId];

        if (file.contributorAddress != msg.sender) {
            revert NotFileOwner();
        }

        if (file.rewardWithdrawn > 0 || file.addedAt + fileRewardDelay > block.timestamp || totalContributorsRewardAmount < file.reward) {
            revert WithdrawNotAllowed();
        }

        if (!file.isVerified) {
            revert FileNotVerified();
        }

        file.rewardWithdrawn = file.reward;
        totalContributorsRewardAmount -= file.reward;
        token.safeTransfer(msg.sender, file.reward);

        emit ContributionRewardClaimed(msg.sender, fileId, file.reward);
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

        uint256 denominatorWAD = Math.sqrt(1e18) *
            Math.sqrt(cWAD + (pWAD * shiftSquaredWAD) / 1e18);

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
    function _normalizeStakes(
        uint256[] memory S
    ) internal pure returns (uint256[] memory) {
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
    function _calculateTrust(
        uint256[][] memory W,
        uint256[] memory S
    ) internal view returns (uint256[] memory) {
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
    function calculateRank(
        uint256[][] memory W,
        uint256[] memory S
    ) internal pure returns (uint256[] memory) {
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
    function calculateConsensus(
        uint256[] memory T
    ) internal view returns (uint256[] memory) {
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
    function _calculateEmissions(
        uint256[] memory C,
        uint256[] memory R
    ) internal pure returns (uint256[] memory) {
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
    function getEmissionScores(
        uint256 epochNumber
    ) public view returns (uint256[] memory) {
        EnumerableSet.AddressSet
            storage epochValidators = _activeValidatorsLists[
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

            ValidatorInfo storage validator = _validatorsInfo[
                epochValidators.at(i)
            ];

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
        EnumerableSet.AddressSet
            storage epochValidators = _activeValidatorsLists[
                _epochs[epochNumber].validatorsListId
            ];

        uint256 epochValidatorsCount = epochValidators.length();

        uint256[] memory shares = getEmissionScores(epochNumber);

        Epoch storage epoch = _epochs[epochNumber];
        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            address validatorAddress = epochValidators.at(i);
            uint256 validatorReward = (shares[i] * epoch.reward) / 1e18;

            uint256 validatorRewardDiff = validatorReward -
                epoch.validatorRewards[validatorAddress].withdrawnAmount;

            epoch.validatorRewards[validatorAddress].share = shares[i];
            epoch
                .validatorRewards[validatorAddress]
                .withdrawnAmount = validatorReward;

            //send the reward to the validator
            if (
                validatorRewardDiff > 0 &&
                totalValidatorsRewardAmount > validatorRewardDiff
            ) {
                totalValidatorsRewardAmount -= validatorRewardDiff;
                token.safeTransfer(
                    _validatorsInfo[validatorAddress].ownerAddress,
                    validatorRewardDiff
                );
            }
        }
    }

    function _inactivateValidator(address validatorAddress) internal {
        ValidatorInfo storage validator = _validatorsInfo[validatorAddress];

        uint256 index;

        EnumerableSet.AddressSet storage currentList = _activeValidatorsLists[
            activeValidatorsListsCount
        ];
        uint256 currentListCount = currentList.length();

        activeValidatorsListsCount++;

        EnumerableSet.AddressSet storage newList = _activeValidatorsLists[
            activeValidatorsListsCount
        ];

        for (index = 0; index < currentListCount; index++) {
            if (currentList.at(index) != validatorAddress) {
                newList.add(currentList.at(index));
            }
        }

        if (validator.filesToVerifyCount == validator.filesToVerifyIndex) {
            _validatorsWithFilesToVerify.remove(validatorAddress);
        }

        _epochs[epochsCount].validatorsListId = activeValidatorsListsCount;

        validator.status = ValidatorStatus.Inactive;
        validator.lastBlockNumber = block.number;

        emit ValidatorInactivated(validatorAddress);
    }

    /**
     * @notice Get all active validators
     *
     * @return address[]                          active validators
     */
    function getActiveValidators() public view returns (address[] memory) {
        uint256 currentValidatorsListId = _epochs[epochsCount].validatorsListId;
        return _activeValidatorsLists[currentValidatorsListId].values();
    }

    /**
     * @notice Get detailed information about a file, including all validator scores
     * @param fileId The ID of the file to retrieve information for
     */
    function getFileInfo(uint256 fileId) external view returns (
        address contributorAddress,
        uint256 addedAt,
        uint256 verificationsCount,
        bool isVerified,
        uint256 overallScore,
        uint256 authenticity,
        uint256 ownership,
        uint256 quality,
        uint256 uniqueness,
        FileVerificationInfo[] memory validatorScores
    ) {
        File storage file = _files[fileId];
        address[] memory activeValidators = getActiveValidators();
        FileVerificationInfo[] memory scores = new FileVerificationInfo[](activeValidators.length);
        uint256 scoreCount = 0;

        for (uint256 i = 0; i < activeValidators.length; i++) {
            FileVerificationInfo storage verification = file.verifications[activeValidators[i]];
            if (verification.reportedAt > 0) {
                scores[scoreCount] = verification;
                scoreCount++;
            }
        }

        // Resize the array to remove empty elements
        assembly {
            mstore(scores, scoreCount)
        }

        return (
            file.contributorAddress,
            file.addedAt,
            file.verificationsCount,
            file.isVerified,
            file.overallScore,
            file.authenticity,
            file.ownership,
            file.quality,
            file.uniqueness,
            scores
        );
    }
}
