// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/DataLiquidityPoolStorageV1.sol";

contract DataLiquidityPool is
    UUPSUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    DataLiquidityPoolStorageV1
{
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /**
     * @notice Triggered when a validator has staked some DAT
     *
     * @param validatorAddress                         address of the validator
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
     * @param validatorAddress                        address of the validator
     * @param ownerAddress                       owner of the validator
     * @param amount                            amount staked in this call
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
     * @param ownerAddress                       owner of the file
     * @param fileId                             file id
     */
    event FileAdded(address indexed ownerAddress, uint256 fileId);

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

    error InvalidStakeAmount();
    error ValidatorAlreadyRegistered();
    error ValidatorNotRegistered();
    error TooManyValidators();
    error NotValidator();
    error MasterKeyAlreadySet();
    error FileAlreadyAdded();
    error FileAlreadyVerified();
    error InvalidFileId();
    error ArityMismatch();
    error NotValidatorColdKey();
    error AddingFilePaused();

    /**
     * @dev Modifier to make a function callable only when the caller is an active validator
     */
    modifier onlyActiveValidators() {
        if (_validatorInfo[msg.sender].status != ValidatorStatus.Active) {
            revert NotValidator();
        }
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the caller is the cold key of the validator
     *
     * @param validatorAddress                         address of the validator
     */
    modifier onlyValidatorOwnerAddress(address validatorAddress) {
        if (_validatorInfo[validatorAddress].ownerAddress != msg.sender) {
            revert NotValidatorColdKey();
        }
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the adding file is not paused
     */
    modifier whenAddingFileNotPaused() {
        if (addingFilePaused) {
            revert AddingFilePaused();
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
     */
    function initialize(
        address ownerAddress,
        uint256 newMaxNumberOfValidators,
        uint256 newValidatorScoreMinTrust,
        uint256 newValidatorScoreKappa,
        uint256 newValidatorScoreRho,
        uint256 newValidationPeriod,
        uint256 newMinStakeAmount,
        uint256 startBlock,
        uint256 newEpochSize,
        uint256 newEpochRewardAmount
    ) external initializer {
        __Ownable_init(ownerAddress);
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

        _epochs[1].startBlock = startBlock;
        _epochs[1].endBlock = startBlock + newEpochSize - 1;
        _epochs[1].reward = newEpochRewardAmount;
        epochsCount++;

        emit EpochCreated(1);

        addingFilePaused = true;
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
        return _fileUrlHases.length();
    }

    /**
     * @notice Get the file information
     *
     * @param fileId                              file id
     */
    function files(
        uint256 fileId
    )
        public
        view
        override
        returns (
            address ownerAddress,
            string memory url,
            string memory encryptedKey,
            uint256 addedTimestamp,
            uint256 verificationsCount
        )
    {
        return (
            _files[fileId].ownerAddress,
            _files[fileId].url,
            _files[fileId].encryptedKey,
            _files[fileId].addedTimestamp,
            _files[fileId].verificationsCount
        );
    }

    /**
     * @notice Get the file verifications
     *
     * @param fileId                              file id
     * @param verificationId                      verification id
     */
    function fileVerifications(
        uint256 fileId,
        uint256 verificationId
    )
        external
        view
        override
        returns (
            address validatorAddress,
            uint256 timespatmp,
            uint256 score,
            string memory metadata
        )
    {
        return (
            _files[fileId].verifications[verificationId].validatorAddress,
            _files[fileId].verifications[verificationId].timespatmp,
            _files[fileId].verifications[verificationId].score,
            _files[fileId].verifications[verificationId].metadata
        );
    }

    /**
     * @notice Get the validator information
     *
     * @param validatorAddress                         address of the validator
     */
    function validatorInfo(
        address validatorAddress
    )
        external
        view
        override
        returns (
            address ownerAddress,
            uint256 stakeAmount,
            ValidatorStatus status,
            uint256 filesToVerifyIndex,
            uint256 filesToVerifyCount
        )
    {
        ownerAddress = _validatorInfo[validatorAddress].ownerAddress;
        stakeAmount = _validatorInfo[validatorAddress].stakeAmount;
        status = _validatorInfo[validatorAddress].status;
        filesToVerifyIndex = _validatorInfo[validatorAddress].filesToVerifyIndex;
        filesToVerifyCount = _validatorInfo[validatorAddress].filesToVerifyCount;
    }

    /**
     * @notice Get the next file to verify
     *
     * @param validatorAddress                   address of the validator
     */
    function getNextFileToVerify(
        address validatorAddress
    ) public view override returns (NextFileToVerify memory) {
        if (
            _validatorInfo[validatorAddress].status != ValidatorStatus.Active
        ) {
            revert NotValidator();
        }

        ValidatorInfo storage validator = _validatorInfo[validatorAddress];
        uint256 nextFileId = validator.filesToVerify[
            validator.filesToVerifyIndex + 1
        ];

        File storage file = _files[nextFileId];

        if (
            nextFileId > 0 &&
            file.addedTimestamp + validationPeriod < block.timestamp
        ) {
            return NextFileToVerify(
                nextFileId,
                file.url,
                file.encryptedKey,
                file.addedTimestamp,
                validatorAddress
            );
        }

        address assignedValidator = validatorAddress;

        uint256 validatorsWithFilesToVerifyCount = _validatorsWithFilesToVerify
            .length();

        File storage otherValidatorFile;
        for (
            uint256 index = 0;
            index < validatorsWithFilesToVerifyCount;
            index++
        ) {
            validator = _validatorInfo[_validatorsWithFilesToVerify.at(index)];

            uint256 otherValidatorNextFileId = validator.filesToVerify[
                validator.filesToVerifyIndex + 1
            ];

            otherValidatorFile = _files[otherValidatorNextFileId];

            if (
                otherValidatorNextFileId > 0 &&
                otherValidatorFile.addedTimestamp + validationPeriod <
                block.timestamp &&
                otherValidatorFile.addedTimestamp < file.addedTimestamp
            ) {
                nextFileId = otherValidatorNextFileId;
                file = otherValidatorFile;
                assignedValidator = _validatorsWithFilesToVerify.at(index);
            }
        }

        return NextFileToVerify(
            nextFileId,
            file.url,
            file.encryptedKey,
            file.addedTimestamp,
            assignedValidator
        );
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
     * @notice Get a list with all registeres validators)
     */
    function validatorsCount() public view returns (uint256) {
        return _validators.length();
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
            shares[i] =           epoch.validatorRewards[validators[i]].share;
            withdrawnAmounts[i] = epoch.validatorRewards[validators[i]].withdrawnAmount;
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
        ValidatorInfo storage validator = _validatorInfo[validatorAddress];

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
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external override onlyOwner {
        createEpochs();
        epochRewardAmount = newEpochRewardAmount;

        emit EpochRewardAmountUpdated(newEpochRewardAmount);
    }

    /**
     * @notice Update the validation period
     *
     * @param newValidationPeriod                new validation period
     */
    function updateValidationPeriod(uint256 newValidationPeriod) external onlyOwner {
        validationPeriod = newValidationPeriod;

        emit ValidationPeriodUpdated(newValidationPeriod);
    }

    /**
     * @notice Update the validatorScoreMinTrust
     *
     * @param newValidatorScoreMinTrust                new validatorScoreMinTrust
     */
    function updateValidatorScoreMinTrust(uint256 newValidatorScoreMinTrust) external onlyOwner {
        validatorScoreMinTrust = newValidatorScoreMinTrust;

        emit ValidatorScoreMinTrustUpdated(newValidatorScoreMinTrust);
    }

    /**
     * @notice Update the validatorScoreKappa
     *
     * @param newValidatorScoreKappa                new validatorScoreKappa
     */
    function updateValidatorScoreKappa(uint256 newValidatorScoreKappa) external onlyOwner {
        validatorScoreKappa = newValidatorScoreKappa;

        emit ValidatorScoreKappaUpdated(newValidatorScoreKappa);
    }

    /**
     * @notice Update the validatorScoreRho
     *
     * @param newValidatorScoreRho                new validatorScoreRho
     */
    function updateValidatorScoreRho(uint256 newValidatorScoreRho) external onlyOwner {
        validatorScoreRho = newValidatorScoreRho;

        emit ValidatorScoreRhoUpdated(newValidatorScoreRho);
    }

    /**
     * @notice Register a validator
     *
     * @param validatorAddress                         address of the validator
     * @param validatorOwnerAddress              owner of the validator
     */
    function registerValidator(
        address validatorAddress,
        address payable validatorOwnerAddress
    ) external payable override whenNotPaused {
        if (_validatorInfo[validatorAddress].status != ValidatorStatus.None) {
            revert ValidatorAlreadyRegistered();
        }

        if (msg.value < minStakeAmount) {
            revert InvalidStakeAmount();
        }

        _validatorInfo[validatorAddress].ownerAddress = validatorOwnerAddress;
        _validatorInfo[validatorAddress].stakeAmount = msg.value;
        _validatorInfo[validatorAddress].status = ValidatorStatus.Registered;

        _validators.add(validatorAddress);

        emit ValidatorRegistered(validatorAddress, validatorOwnerAddress, msg.value);
    }

    function approveValidator(
        address  validatorAddress
    ) public onlyOwner {
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

        if(_validatorInfo[validatorAddress].status != ValidatorStatus.Registered) {
            revert ValidatorNotRegistered();
        }
        newActiveValidatorsList.add(validatorAddress);
        _validatorsWithFilesToVerify.add(validatorAddress);

        _validatorInfo[validatorAddress].status = ValidatorStatus
            .Active;

        _epochs[epochsCount].validatorsListId = activeValidatorsListsCount;

        if(addingFilePaused) {
            addingFilePaused = false;
        }

        emit ValidatorApproved(validatorAddress);
    }

     /**
      * @notice Approve validator
      *
      * @param validatorAddress                        validator addresses
      */
     function deregisterValidator(
         address validatorAddress
     ) external onlyValidatorOwnerAddress(msg.sender) {
         createEpochs();

         if(_validatorInfo[validatorAddress].status != ValidatorStatus.Registered) {
             revert ValidatorNotRegistered();
         }

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
             if(activeValidatorsList.at(index) != validatorAddress) {
                newActiveValidatorsList.add(activeValidatorsList.at(index));
             }
         }

         ValidatorInfo storage validator = _validatorInfo[validatorAddress];

         if(validator.filesToVerifyCount == validator.filesToVerifyIndex) {
            _validatorsWithFilesToVerify.remove(validatorAddress);
         }

         _validatorInfo[validatorAddress].status = ValidatorStatus
             .Deregistered;

         _epochs[epochsCount].validatorsListId = activeValidatorsListsCount;

         if(activeValidatorsListCount == 1) {
             addingFilePaused = true;
         }

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
     *
     * @param url                                    file url
     * @param encryptedKey                           encrypted key
     */
    function addFile(string memory url, string memory encryptedKey) external whenNotPaused whenAddingFileNotPaused {
        createEpochs();
        bytes32 urlHash = keccak256(abi.encodePacked(url));
        if (_fileUrlHases.contains(urlHash)) {
            revert FileAlreadyAdded();
        }

        _fileUrlHases.add(urlHash);
        uint256 filesId = _fileUrlHases.length();

        File storage file = _files[filesId];

        file.ownerAddress = msg.sender;
        file.url = url;
        file.encryptedKey = encryptedKey;
        file.addedTimestamp = block.timestamp;

        uint256 epochValidatorsListId = _epochs[epochsCount].validatorsListId;

        uint256 epochValidatorsCount = _activeValidatorsLists[
            epochValidatorsListId
        ].length();

        address assignedValidator = _activeValidatorsLists[
            epochValidatorsListId
        ].at(filesId % epochValidatorsCount);

        ValidatorInfo storage validator = _validatorInfo[assignedValidator];
        validator.filesToVerifyCount++;
        validator.filesToVerify[validator.filesToVerifyCount] = filesId;

        emit FileAdded(msg.sender, filesId);
    }

    /**
     * @notice Verify a file
     *
     * @param fileId                              file id
     * @param score                               score of the verification
     * @param metadata                            metadata
     */
    function verifyFile(
        uint256 fileId,
        uint256 score,
        string memory metadata
    ) external onlyActiveValidators {
        createEpochs();

        if (_files[fileId].verificationsCount > 0) {
            revert FileAlreadyVerified();
        }

        NextFileToVerify memory nextFileToVerify = getNextFileToVerify(
            msg.sender
        );

        if (nextFileToVerify.fileId != fileId || fileId == 0) {
            revert InvalidFileId();
        }

        File storage file = _files[fileId];

        FileVerificationInfo storage verification = file.verifications[
            file.verificationsCount
        ];

        file.verificationsCount++;

        verification.validatorAddress = msg.sender;
        verification.timespatmp = block.timestamp;
        verification.score = score;
        verification.metadata = metadata;

        _validatorInfo[nextFileToVerify.assignedValidator].filesToVerifyIndex++;

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
    ) external onlyActiveValidators {
        createEpochs();

        uint256 length = validators.length;

        if (length != weights.length) {
            revert ArityMismatch();
        }

        ValidatorInfo storage validator = _validatorInfo[msg.sender];

        for (uint256 i = 0; i < weights.length; i++) {
            validator.weights[validators[i]] = weights[i];
        }

        emit WeightsUpdated(msg.sender, validators, weights);
    }

    /**
     * @notice Add rewards to the pool
     */
    function addRewards() external payable {
        totalRewardAmount += msg.value;
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

        require(totalScore > 0, "Division by zero in calculateRank");

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

        require(totalEmissions > 0, "Division by zero in calculateEmissions");

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
        EnumerableSet.AddressSet storage epochValidators = _activeValidatorsLists[
            _epochs[epochNumber].validatorsListId
        ];

        uint256 epochValidatorsCount = epochValidators.length();

        uint256[] memory S = new uint256[](epochValidatorsCount);

        bool hasAnyStake = false;
        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            S[i] = _validatorInfo[epochValidators.at(i)].stakeAmount;
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

            ValidatorInfo storage validator = _validatorInfo[
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
        EnumerableSet.AddressSet storage epochValidators = _activeValidatorsLists[
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
                totalRewardAmount > validatorRewardDiff
            ) totalRewardAmount -= validatorRewardDiff;
            _validatorInfo[validatorAddress].ownerAddress.transfer(
                validatorRewardDiff
            );
        }
    }
}
