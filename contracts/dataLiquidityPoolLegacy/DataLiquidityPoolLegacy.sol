// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/DataLiquidityPoolStorageV1.sol";

contract DataLiquidityPoolLegacy is
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
     * @param totalAmount                        total amount staked by the validator
     */
    event ValidatorRegisterd(
        address indexed validatorAddress,
        address indexed ownerAddress,
        uint256 amount,
        uint256 totalAmount
    );

    /**
     * @notice Triggered when a validator has been approved
     *
     * @param validatorAddress                   address of the validator
     */
    event ValidatorApproved(address indexed validatorAddress);

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
     * @notice Triggered when a reward period has been created
     *
     * @param rewardPeriodId                  reward period id
     */
    event RewardPeriodCreated(uint256 rewardPeriodId);

    /**
     * @notice Triggered when a validator has updated its weights
     *
     * @param validatorAddress                   address of the validator
     * @param validators                         validators
     * @param weights                            weights
     */
    event WeightUpdated(
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
     * @notice Triggered when the reward period size has been updated
     *
     * @param newRewardPeriodSize                new reward period size
     */
    event RewardPeriodSizeUpdated(uint256 newRewardPeriodSize);

    error InvalidStakeAmount();
    error ValidatorAlreadyRegistered();
    error ValidatorAlreadyApproved();
    error TooManyValidators();
    error NotValidator();
    error MasterKeyAlreadySet();
    error FileAlreadyAdded();
    error FileAlreadyVerified();
    error InvalidFileId();
    error ArityMismatch();

    modifier onlyActiveValidators() {
        if (_validatorInfo[msg.sender].status != ValidatorStatus.Active) {
            revert NotValidator();
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
     * @param newRewardPeriodSize                reward period size
     * @param newRewardAmount                    reward amount
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
        uint256 newRewardPeriodSize,
        uint256 newRewardAmount
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
        rewardPeriodSize = newRewardPeriodSize;
        rewardAmount = newRewardAmount;

        _rewardPeriods[1].startBlock = startBlock;
        _rewardPeriods[1].endBlock = startBlock + newRewardPeriodSize - 1;
        _rewardPeriods[1].reward = newRewardAmount;
        rewardPeriodsCount++;

        emit RewardPeriodCreated(1);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

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
            uint256 addedTime,
            uint256 verificationsLength
        )
    {
        return (
            _files[fileId].ownerAddress,
            _files[fileId].url,
            _files[fileId].encryptedKey,
            _files[fileId].addedTimestamp,
            _files[fileId].verificationsLength
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
     * @param validatorAddress                   address of the validator
     */
    function validatorInfo(
        address validatorAddress
    )
        external
        view
        override
        returns (
            uint256 id,
            address ownerAddress,
            uint256 stakeAmount,
            ValidatorStatus status,
            uint256 lastVerifiedFileId
        )
    {
        id = _validatorInfo[validatorAddress].id;
        ownerAddress = _validatorInfo[validatorAddress].ownerAddress;
        stakeAmount = _validatorInfo[validatorAddress].stakeAmount;
        status = _validatorInfo[validatorAddress].status;
        lastVerifiedFileId = _validatorInfo[validatorAddress]
            .lastVerifiedFileId;
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

    function updateMaxNumberOfValidators(
        uint256 newMaxNumberOfValidators
    ) external onlyOwner {
        maxNumberOfValidators = newMaxNumberOfValidators;

        emit MaxNumberOfValidatorsUpdated(newMaxNumberOfValidators);
    }

    function updateRewardPeriodSize(
        uint256 newRewardPeriodSize
    ) external onlyOwner {
        rewardPeriodSize = newRewardPeriodSize;

        emit RewardPeriodSizeUpdated(newRewardPeriodSize);
    }

    /**
     * @notice Register as a validator
     *
     * @param validatorAddress                   address of the validator
     * @param validatorOwnerAddress              owner of the validator
     */
    function registerAsValidator(
        address validatorAddress,
        address payable validatorOwnerAddress
    ) external payable whenNotPaused {
        if (_validatorInfo[validatorAddress].status != ValidatorStatus.None) {
            revert ValidatorAlreadyRegistered();
        }

        if (msg.value < minStakeAmount) {
            revert InvalidStakeAmount();
        }

        _validatorInfo[validatorAddress].ownerAddress = validatorOwnerAddress;
        _validatorInfo[validatorAddress].stakeAmount = msg.value;
        _validatorInfo[validatorAddress].status = ValidatorStatus.Pending;

        _validators.add(validatorAddress);

        emit ValidatorRegisterd(
            validatorAddress,
            validatorOwnerAddress,
            msg.value,
            msg.value
        );
    }

    /**
     * @notice Approve validator
     *
     * @param newValidatorAddress               validator addresses
     */
    function acceptValidator(address newValidatorAddress) external onlyOwner {
        createRewardPeriods();
        //todo: to be removed

        ValidatorInfo storage validator = _validatorInfo[newValidatorAddress];
        if (validator.status != ValidatorStatus.Pending) {
            revert ValidatorAlreadyApproved();
        }

        ValidatorList
            storage currentActiveValidatorList = _activeValidatorLists[
                activeValidatorListsCount
            ];
        uint256 currentActiveValidatorListCount = currentActiveValidatorList
            .count;

        if (currentActiveValidatorListCount >= maxNumberOfValidators) {
            revert TooManyValidators();
        }

        uint256 index;

        activeValidatorListsCount++;
        ValidatorList storage newActiveValidatorList = _activeValidatorLists[
            activeValidatorListsCount
        ];

        for (index = 0; index < currentActiveValidatorListCount; index++) {
            newActiveValidatorList.validators[
                index
            ] = currentActiveValidatorList.validators[index];
        }

        newActiveValidatorList.validators[
            currentActiveValidatorListCount
        ] = newValidatorAddress;

        newActiveValidatorList.count = currentActiveValidatorListCount + 1;

        validator.status = ValidatorStatus.Active;
        validator.id = newActiveValidatorList.count;

        RewardPeriod storage rewardPeriod = _rewardPeriods[rewardPeriodsCount];
        rewardPeriod.validatorListId = activeValidatorListsCount;

        emit ValidatorApproved(newValidatorAddress);
    }

    /**
     * @notice Set the master key
     *
     * @param newMasterKey                       new master key
     */
    function setMasterKey(
        string memory newMasterKey
    ) external onlyActiveValidators returns (string memory) {
        if (bytes(masterKey).length != 0) {
            revert MasterKeyAlreadySet();
        }
        masterKey = newMasterKey;

        emit MasterKeySet(newMasterKey);
    }

    /**
     * @notice Add a file to the pool
     *
     * @param url                            file url
     * @param encryptedKey                           encrypted key
     */
    function addFile(string memory url, string memory encryptedKey) external {
        createRewardPeriods();
        bytes32 urlHash = keccak256(abi.encodePacked(url));
        if (_fileUrls.contains(urlHash)) {
            revert FileAlreadyAdded();
        }

        _fileUrls.add(urlHash);
        uint256 filesId = _fileUrls.length();

        _files[filesId].ownerAddress = msg.sender;
        _files[filesId].url = url;
        _files[filesId].encryptedKey = encryptedKey;
        _files[filesId].addedTimestamp = block.timestamp;

        emit FileAdded(msg.sender, filesId);
    }

    function getNextFileToVerifyByValidator(
        address validatorAddress
    ) internal view returns (uint256) {
        uint256 lvf = _validatorInfo[validatorAddress].lastVerifiedFileId;
        uint256 validatorId = _validatorInfo[validatorAddress].id;
        uint256 nr = getCurrentRewardPeriodValidators();

        uint256 nextFileIdDiff = (nr + validatorId - (lvf % nr)) % nr;

        uint256 nextFileId = nextFileIdDiff == 0
            ? lvf + nr
            : lvf + nextFileIdDiff;
        return
            _files[nextFileId].ownerAddress != address(0) &&
                _files[nextFileId].verificationsLength == 0
                ? nextFileId
                : 0;
    }

    function getNextFileToVerify(
        address validatorAddress
    )
        external
        view
        returns (
            uint256 fileId,
            string memory url,
            string memory encryptedKey,
            uint256 addedTime
        )
    {
        if (_validatorInfo[validatorAddress].status != ValidatorStatus.Active) {
            revert NotValidator();
        }

        uint256 nextFileId = getNextFileToVerifyByValidator(validatorAddress);

        while (_files[nextFileId].verificationsLength != 0) {
            nextFileId++;
        }

        if (nextFileId > _fileUrls.length()) {
            nextFileId = 0;
        }

        return (
            nextFileId,
            _files[nextFileId].url,
            _files[nextFileId].encryptedKey,
            _files[nextFileId].addedTimestamp
        );
    }

    function verifyFile(
        uint256 fileId,
        uint256 score,
        string memory metadata
    ) external onlyActiveValidators {
        createRewardPeriods();

        if (_files[fileId].verificationsLength > 0) {
            revert FileAlreadyVerified();
        }

        if (
            getNextFileToVerifyByValidator(msg.sender) != fileId || fileId == 0
        ) {
            revert InvalidFileId();
        }

        File storage file = _files[fileId];

        FileVerificationInfo storage verification = file.verifications[
            file.verificationsLength
        ];

        file.verificationsLength++;

        verification.validatorAddress = msg.sender;
        verification.timespatmp = block.timestamp;
        verification.score = score;
        verification.metadata = metadata;

        if (_validatorInfo[msg.sender].lastVerifiedFileId < fileId) {
            _validatorInfo[msg.sender].lastVerifiedFileId = fileId;
        }

        emit FileVerified(msg.sender, fileId, score);
    }

    function rewardPeriods(
        uint256 period
    )
        external
        view
        returns (
            uint256 startBlock,
            uint256 endBlock,
            uint256 reward,
            uint256 validatorListId
        )
    {
        return (
            _rewardPeriods[period].startBlock,
            _rewardPeriods[period].endBlock,
            _rewardPeriods[period].reward,
            _rewardPeriods[period].validatorListId
        );
    }

    function activeValidatorListCount(
        uint256 listId
    ) external view returns (uint256 count) {
        return _activeValidatorLists[listId].count;
    }

    function activeValidatorLists(
        uint256 id
    ) public view override returns (address[] memory) {
        ValidatorList storage activeValidatorList = _activeValidatorLists[id];

        uint256 count = activeValidatorList.count;
        address[] memory activeValidators = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            activeValidators[i] = activeValidatorList.validators[i];
        }

        return activeValidators;
    }

    function createRewardPeriods() public override {
        RewardPeriod storage lastPeriod = _rewardPeriods[rewardPeriodsCount];

        if (lastPeriod.endBlock >= block.number) {
            return;
        }

        uint256 rewardPeriodCountTemp = rewardPeriodsCount;

        while (lastPeriod.endBlock < block.number) {
            _setEmissionScores(rewardPeriodCountTemp);
            rewardPeriodCountTemp++;
            RewardPeriod storage newPeriod = _rewardPeriods[
                rewardPeriodCountTemp
            ];

            newPeriod.validatorListId = lastPeriod.validatorListId;
            newPeriod.startBlock = lastPeriod.endBlock + 1;
            newPeriod.endBlock = newPeriod.startBlock + rewardPeriodSize - 1;
            newPeriod.reward = rewardAmount;

            lastPeriod = newPeriod;

            emit RewardPeriodCreated(rewardPeriodCountTemp);
        }

        rewardPeriodsCount = rewardPeriodCountTemp;
    }

    function updateWeights(
        address[] memory validators,
        uint256[] memory weights
    ) external onlyActiveValidators {
        uint256 length = validators.length;

        if (length != weights.length) {
            revert ArityMismatch();
        }

        ValidatorInfo storage validator = _validatorInfo[msg.sender];

        for (uint256 i = 0; i < weights.length; i++) {
            validator.weights[validators[i]] = weights[i];
        }

        emit WeightUpdated(msg.sender, validators, weights);
    }

    function getCurrentRewardPeriodValidators() public view returns (uint256) {
        ValidatorList
            storage currentActiveValidatorList = _activeValidatorLists[
                _rewardPeriods[rewardPeriodsCount].validatorListId
            ];
        return currentActiveValidatorList.count;
    }

    function validators() public view returns (address[] memory) {
        return _validators.values();
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function overrideLastVerifiedFileId(
        address validatorAddress,
        uint256 fileId
    ) external onlyOwner {
        _validatorInfo[validatorAddress].lastVerifiedFileId = fileId;
    }

    function getRewardPeriodValidatorRewards(
        uint256 period
    ) external view returns (address[] memory, uint256[] memory) {
        ValidatorList storage validatorList = _activeValidatorLists[
            _rewardPeriods[period].validatorListId
        ];

        uint256 validatorsCount = validatorList.count;

        address[] memory validators = new address[](validatorsCount);
        uint256[] memory rewards = new uint256[](validatorsCount);

        for (uint256 i = 0; i < validatorsCount; i++) {
            validators[i] = validatorList.validators[i];
            rewards[i] = _rewardPeriods[period]
                .validatorRewards[validatorList.validators[i]]
                .share;
        }

        return (validators, rewards);
    }

    function addRewards() external payable {
        totalRewardAmount += msg.value;
    }

    function getWeightsAssignedByValidator(
        address validatorAddress
    ) external view returns (uint256[] memory) {
        ValidatorInfo storage validator = _validatorInfo[validatorAddress];

        ValidatorList
            storage currentActiveValidatorList = _activeValidatorLists[
                _rewardPeriods[rewardPeriodsCount].validatorListId
            ];

        uint256[] memory weights = new uint256[](
            currentActiveValidatorList.count
        );

        for (uint256 i = 0; i < currentActiveValidatorList.count; i++) {
            weights[i] = validator.weights[
                currentActiveValidatorList.validators[i]
            ];
        }

        return weights;
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
    ) public view returns (uint256) {
        // ---- Calculate (x - k) * WAD ----
        // Start with xWAD and kWAD: x * WAD - k * WAD = (x - k) * WAD
        //todo: the original code is wrong, it should be xWAD - kWAD, but sometimes xWAD is less than kWAD so we neeed another formula in this case
        uint256 shiftWAD = xWAD > kWAD ? xWAD - kWAD : 0;

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
        return (aWAD * numeratorWAD) / denominatorWAD + aWAD;
    }

    /**
     * @notice Set the emission scores for the validators
     *
     * @param S                                   stake amounts
     */
    function normalizeStakes(
        uint256[] memory S
    ) internal view returns (uint256[] memory) {
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
    function calculateTrust(
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
    ) internal view returns (uint256[] memory) {
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
    function calculateEmissions(
        uint256[] memory C,
        uint256[] memory R
    ) internal view returns (uint256[] memory) {
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
     * @param rewardPeriodNumer                   reward period number
     */
    function getEmissionScores(
        uint256 rewardPeriodNumer
    ) public view returns (uint256[] memory) {
        ValidatorList storage validatorList = _activeValidatorLists[
            _rewardPeriods[rewardPeriodNumer].validatorListId
        ];

        uint256 validatorsCount = validatorList.count;

        uint256[] memory S = new uint256[](validatorsCount);

        for (uint256 i = 0; i < validatorsCount; i++) {
            S[i] = _validatorInfo[validatorList.validators[i]].stakeAmount;
        }

        uint256[][] memory W = new uint256[][](validatorsCount);
        for (uint256 i = 0; i < validatorsCount; i++) {
            W[i] = new uint256[](validatorsCount);

            ValidatorInfo storage validator = _validatorInfo[
                validatorList.validators[i]
            ];

            for (uint256 j = 0; j < validatorsCount; j++) {
                W[i][j] = validator.weights[validatorList.validators[j]];
            }
        }

        uint256[] memory normalizedStakes = normalizeStakes(S);
        uint256[] memory T = calculateTrust(W, normalizedStakes);
        uint256[] memory R = calculateRank(W, normalizedStakes);
        uint256[] memory C = calculateConsensus(T);
        return calculateEmissions(C, R);
    }

    /**
     * @notice Set the emission scores for the validators
     *
     * @param rewardPeriodNumber                   reward period number
     */
    function _setEmissionScores(uint256 rewardPeriodNumber) internal {
        ValidatorList storage validatorList = _activeValidatorLists[
            _rewardPeriods[rewardPeriodNumber].validatorListId
        ];

        uint256 validatorsCount = validatorList.count;

        uint256[] memory shares = getEmissionScores(rewardPeriodNumber);

        RewardPeriod storage rewardPeriod = _rewardPeriods[rewardPeriodNumber];
        for (uint256 i = 0; i < validatorsCount; i++) {
            uint256 validatorReward = (shares[i] * rewardPeriod.reward) / 1e18;

            uint256 validatorRewardDiff = validatorReward -
                rewardPeriod
                    .validatorRewards[validatorList.validators[i]]
                    .withdrawedAmount;

            rewardPeriod
                .validatorRewards[validatorList.validators[i]]
                .share = shares[i];

            //send the reward to the validator
            if (
                validatorRewardDiff > 0 &&
                totalRewardAmount > validatorRewardDiff
            ) {
                totalRewardAmount -= validatorRewardDiff;
                _validatorInfo[validatorList.validators[i]]
                    .ownerAddress
                    .transfer(validatorRewardDiff);
                rewardPeriod
                    .validatorRewards[validatorList.validators[i]]
                    .withdrawedAmount = validatorReward;
            }
        }
    }
}
