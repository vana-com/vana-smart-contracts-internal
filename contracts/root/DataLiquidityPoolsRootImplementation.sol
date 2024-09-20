// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/DataLiquidityPoolsRootStorageV1.sol";

contract DataLiquidityPoolsRootImplementation is
    UUPSUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    ReentrancyGuardUpgradeable,
    DataLiquidityPoolsRootStorageV1
{
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using Checkpoints for Checkpoints.Trace208;

    using SafeERC20 for IERC20;

    /**
     * @notice Triggered when a dlp has registered
     *
     * @param dlpId                        id of the dlp
     * @param dlpAddress                   address of the dlp
     * @param ownerAddress                 owner of the dlp
     */
    event DlpRegistered(uint256 indexed dlpId, address indexed dlpAddress, address indexed ownerAddress);

    /**
     * @notice Triggered when a dlp has been deregistered
     *
     * @param dlpId                   id of the dlp
     */
    event DlpDeregistered(uint256 indexed dlpId);

    /**
     * @notice Triggered when a epoch has been created
     *
     * @param epochId                  reward epoch id
     */
    event EpochCreated(uint256 epochId);

    /**
     * @notice Triggered when the max number of registered dlps has been updated
     *
     * @param newMaxNumberOfRegisteredDlps           new max number of registered dlps
     */
    event MaxNumberOfRegisteredDlpsUpdated(uint256 newMaxNumberOfRegisteredDlps);

    /**
     * @notice Triggered when the max number of top dlps has been updated
     *
     * @param newNumberOfTopDlps           new max number of dlps
     */
    event NumberOfTopDlpsUpdated(uint256 newNumberOfTopDlps);

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
     * @notice Triggered when the minDlpStakeAmount has been updated
     *
     * @param newMinDlpStakeAmount                new minDlpStakeAmount
     */
    event MinDlpStakeAmountUpdated(uint256 newMinDlpStakeAmount);

    /**
     * @notice Triggered when a staker has claimed a reward for a dlp in an epoch
     *
     * @param staker                              address of the staker
     * @param dlpId                               id of the dlp
     * @param epochId                             epoch id
     * @param claimAmount                         amount claimed
     */
    event StakerDlpEpochRewardClaimed(address staker, uint256 dlpId, uint256 epochId, uint256 claimAmount);

    /**
     * @notice Triggered when user has stake some DAT for a DLP
     *
     * @param staker                            address of the staker
     * @param dlpId                             id of the dlp
     * @param amount                            amount stake
     */
    event Staked(address indexed staker, uint256 indexed dlpId, uint256 amount);

    /**
     * @notice Triggered when user has unstake some DAT from a DLP
     *
     * @param staker                            address of the staker
     * @param dlpId                             id of the dlp
     * @param amount                            amount unstake
     */
    event Unstaked(address indexed staker, uint256 indexed dlpId, uint256 amount);

    /**
     * @notice Triggered when epoch performances have been saved
     *
     * @param epochId                         epoch id
     * @param isFinalised                           true if the performances are final
     */
    event EpochPerformancesSaved(uint256 epochId, bool isFinalised);

    /**
     * @notice Triggered when the performance percentages has been updated
     *
     * @param newTtfPercentage                new ttf percentage
     * @param newTfcPercentage                new tfc percentage
     * @param newVduPercentage                new vdu percentage
     * @param newUwPercentage                 new uw percentage
     */
    event PerformancePercentagesUpdated(
        uint256 newTtfPercentage,
        uint256 newTfcPercentage,
        uint256 newVduPercentage,
        uint256 newUwPercentage
    );

    /**
     * @notice Triggered when the dlp stakers percentage has been updated
     *
     * @param dlpId                         id of the dlp
     * @param stakersPercentage             new stakers percentage
     */
    event DlpStakersPercentageUpdated(uint256 dlpId, uint256 stakersPercentage);

    error InvalidStakeAmount();
    error InvalidUnstakeAmount();
    error InvalidDlpStatus();
    error TooManyDlps();
    error NotDlpOwner();
    error ArityMismatch();
    error NotAllowed();
    error InvalidDlpList();
    error NothingToClaim();
    error CurrentEpochNotCreated();
    error InvalidPerformancePercentages();
    error AlreadyDistributed();
    error EpochNotStarted();
    error PreviousEpochNotFinalised();
    error EpochNotEnded();
    error EpochEnded();
    error EpochFinalised();
    error InvalidStakersPercentage();
    error TransferFailed();

    /**
     * @dev Modifier to make a function callable only when the caller is the owner of the dlp
     *
     * @param dlpId                         id of the dlp
     */
    modifier onlyDlpOwner(uint256 dlpId) {
        if (_dlps[dlpId].ownerAddress != msg.sender) {
            revert NotDlpOwner();
        }
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the current epoch was created
     */
    modifier whenCurrentEpoch() {
        if (_epochs[epochsCount].endBlock < block.number) {
            revert CurrentEpochNotCreated();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    struct InitParams {
        address payable ownerAddress;
        uint256 maxNumberOfRegisteredDlps;
        uint256 numberOfTopDlps;
        uint256 minDlpStakeAmount;
        uint256 startBlock;
        uint256 epochSize;
        uint256 epochRewardAmount;
        uint256 ttfPercentage;
        uint256 tfcPercentage;
        uint256 vduPercentage;
        uint256 uwPercentage;
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

        maxNumberOfRegisteredDlps = params.maxNumberOfRegisteredDlps;
        numberOfTopDlps = params.numberOfTopDlps;
        minDlpStakeAmount = params.minDlpStakeAmount;
        epochSize = params.epochSize;
        epochRewardAmount = params.epochRewardAmount;

        ttfPercentage = params.ttfPercentage;
        tfcPercentage = params.tfcPercentage;
        vduPercentage = params.vduPercentage;
        uwPercentage = params.uwPercentage;

        if (ttfPercentage + tfcPercentage + vduPercentage + uwPercentage != 100e18) {
            revert InvalidPerformancePercentages();
        }

        Epoch storage epoch0 = _epochs[0];
        epoch0.startBlock = Math.min(params.startBlock - 2, block.number);
        epoch0.endBlock = params.startBlock - 1;
        epoch0.isFinalised = true;

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
     * returns the version of the contract
     */
    function version() external pure virtual override returns (uint256) {
        return 1;
    }

    /**
     * @notice Gets the dlp information
     *
     * @param dlpId                         id of the dlp
     */
    function dlps(uint256 dlpId) public view override returns (DlpResponse memory) {
        Dlp storage dlp = _dlps[dlpId];

        return
            DlpResponse({
                id: dlp.id,
                dlpAddress: dlp.dlpAddress,
                ownerAddress: dlp.ownerAddress,
                stakeAmount: dlp.stakeAmountCheckpoints.latest(),
                status: dlp.status,
                registrationBlockNumber: dlp.registrationBlockNumber,
                grantedAmount: dlp.grantedAmount,
                stakersPercentage: dlp.stakersPercentage
            });
    }

    /**
     * @notice Gets the dlp information
     *
     * @param dlpAddress                         address of the dlp
     */
    function dlpsByAddress(address dlpAddress) external view override returns (DlpResponse memory) {
        return dlps(dlpIds[dlpAddress]);
    }

    /**
     * @notice Gets registered dlps list
     */
    function registeredDlps() external view override returns (uint256[] memory) {
        return _registeredDlps.values();
    }

    /**
     * @notice Gets epoch information
     *
     * @param epochId                         epoch id
     */
    function epochs(uint256 epochId) external view override returns (EpochInfo memory) {
        return
            EpochInfo({
                startBlock: _epochs[epochId].startBlock,
                endBlock: _epochs[epochId].endBlock,
                reward: _epochs[epochId].rewardAmount,
                isFinalised: _epochs[epochId].isFinalised,
                dlpIds: _epochs[epochId].dlpIds.values()
            });
    }

    /**
     * @notice Gets epoch dlp information
     *
     * @param dlpId                           id of the dlp
     * @param epochId                         epoch id
     */
    function dlpEpochs(uint256 dlpId, uint256 epochId) external view override returns (DlpEpochInfo memory) {
        EpochDlp memory epochDlp = _epochs[epochId].dlps[dlpId];
        return
            DlpEpochInfo({
                ttf: epochDlp.ttf,
                tfc: epochDlp.tfc,
                vdu: epochDlp.vdu,
                uw: epochDlp.uw,
                stakeAmount: _dlps[dlpId].stakeAmountCheckpoints.upperLookup(
                    SafeCast.toUint48(_epochs[epochId].startBlock - 1)
                ),
                isTopDlp: _epochs[epochId].dlpIds.contains(dlpId),
                rewardAmount: epochDlp.rewardAmount,
                stakersPercentage: epochDlp.stakersPercentage
            });
    }

    /**
     * @notice Gets the number of dlps for which the staker has staked
     */
    function stakerDlpsListCount(address staker) external view override returns (uint256) {
        return _stakers[staker].dlpIds.length();
    }

    /**
     * @notice Gets the information about the dlp for a staker
     *
     * @param stakerAddress                        address of the staker
     * @param dlpId                         id of the dlp
     */
    function stakerDlps(address stakerAddress, uint256 dlpId) external view override returns (StakerDlpInfo memory) {
        return
            StakerDlpInfo({
                dlpId: dlpId,
                stakeAmount: _dlps[dlpId].stakers[stakerAddress].stakeAmountCheckpoints.latest(),
                lastClaimedEpochId: _dlps[dlpId].stakers[stakerAddress].lastClaimedEpochId
            });
    }

    /**
     * @notice Gets the information about the dlps for which the staker has staked
     *
     * @param stakerAddress                        address of the staker
     */
    function stakerDlpsList(address stakerAddress) external view override returns (StakerDlpInfo[] memory) {
        Staker storage staker = _stakers[stakerAddress];
        StakerDlpInfo[] memory stakerDlpsList = new StakerDlpInfo[](staker.dlpIds.length());

        for (uint256 i = 0; i < staker.dlpIds.length(); i++) {
            uint256 dlpId = staker.dlpIds.at(i);
            stakerDlpsList[i] = StakerDlpInfo({
                dlpId: dlpId,
                stakeAmount: _dlps[dlpId].stakers[stakerAddress].stakeAmountCheckpoints.latest(),
                lastClaimedEpochId: _dlps[dlpId].stakers[stakerAddress].lastClaimedEpochId
            });
        }

        return stakerDlpsList;
    }

    /**
     * @notice Gets information about the staker for a dlp in an epoch
     *
     * @param staker                          address of the staker
     * @param epochId                         epoch id
     * @param dlpId                           id of the dlp
     */
    function stakerDlpEpochs(
        address staker,
        uint256 dlpId,
        uint256 epochId
    ) external view override returns (StakerDlpEpochInfo memory) {
        uint256 stakeAmount = _dlps[dlpId].stakers[staker].stakeAmountCheckpoints.upperLookup(
            SafeCast.toUint48(_epochs[epochId].startBlock - 1)
        );

        EpochDlp storage epochDlp = _epochs[epochId].dlps[dlpId];
        return
            StakerDlpEpochInfo({
                dlpId: dlpId,
                epochId: epochId,
                stakeAmount: stakeAmount,
                rewardAmount: epochDlp.stakeAmount > 0
                    ? (((epochDlp.rewardAmount * epochDlp.stakersPercentage) / 100e18) * stakeAmount) /
                        epochDlp.stakeAmount
                    : 0,
                claimAmount: _dlps[dlpId].stakers[staker].claimAmounts[epochId]
            });
    }

    /**
     * @notice Gets the claimable amount for a staker for a dlp
     *
     * @param stakerAddress                        address of the staker
     * @param dlpId                         id of the dlp
     */
    function claimableAmount(address stakerAddress, uint256 dlpId) external view override returns (uint256) {
        DlpStaker storage dlpStaker = _dlps[dlpId].stakers[stakerAddress];

        uint256 totalRewardAmount;
        uint256 lastClaimedEpochId = dlpStaker.lastClaimedEpochId;

        while (lastClaimedEpochId < epochsCount) {
            lastClaimedEpochId++;

            Epoch storage epoch = _epochs[lastClaimedEpochId];
            EpochDlp storage epochDlp = epoch.dlps[dlpId];

            if (!epoch.isFinalised) {
                break;
            }

            totalRewardAmount += epochDlp.stakeAmount > 0
                ? (((dlpStaker.stakeAmountCheckpoints.upperLookup(SafeCast.toUint48(epoch.startBlock - 1)) *
                    epochDlp.rewardAmount) / epochDlp.stakeAmount) * epochDlp.stakersPercentage) / 100e18
                : 0;
        }

        return totalRewardAmount;
    }

    /**
     * @notice Gets the top dlps ids
     *
     * @param numberOfDlps                        number of dlps
     */
    function topDlpIds(uint256 numberOfDlps) public view override returns (uint256[] memory) {
        uint256[] memory registeredDlpIds = _registeredDlps.values();
        uint256 registeredDlpsCount = registeredDlpIds.length;

        numberOfDlps = Math.min(numberOfDlps, registeredDlpsCount);

        uint256[] memory topDlpIds = new uint256[](numberOfDlps);

        if (numberOfDlps == 0) {
            return topDlpIds;
        }

        uint256[] memory topStakes = new uint256[](numberOfDlps);

        for (uint256 i = 0; i < registeredDlpsCount; i++) {
            uint256 currentDlpId = registeredDlpIds[i];
            uint256 currentStake = _dlps[currentDlpId].stakeAmountCheckpoints.latest();

            // Find the position where this DLP's stake would be placed
            uint256 position = numberOfDlps;
            for (uint256 j = 0; j < numberOfDlps; j++) {
                if (currentStake > topStakes[j] || (currentStake == topStakes[j] && currentDlpId < topDlpIds[j])) {
                    position = j;
                    break;
                }
            }

            // If it's within the top k, insert it and shift the others down
            if (position < numberOfDlps) {
                for (uint256 j = numberOfDlps - 1; j > position; j--) {
                    topDlpIds[j] = topDlpIds[j - 1];
                    topStakes[j] = topStakes[j - 1];
                }
                topDlpIds[position] = currentDlpId;
                topStakes[position] = currentStake;
            }
        }

        return topDlpIds;
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
     * @notice Updates the maximum number of registered dlps
     *
     * @param newMaxNumberOfRegisteredDlps           new maximum number of dlps
     */
    function updateMaxNumberOfRegisteredDlps(
        uint256 newMaxNumberOfRegisteredDlps
    ) external override onlyOwner whenCurrentEpoch {
        maxNumberOfRegisteredDlps = newMaxNumberOfRegisteredDlps;

        emit MaxNumberOfRegisteredDlpsUpdated(newMaxNumberOfRegisteredDlps);
    }
    /**
     * @notice Updates the maximum number of top dlps
     *
     * @param newNumberOfTopDlps           new maximum number of dlps
     */
    function updateNumberOfTopDlps(uint256 newNumberOfTopDlps) external override onlyOwner whenCurrentEpoch {
        numberOfTopDlps = newNumberOfTopDlps;

        emit NumberOfTopDlpsUpdated(newNumberOfTopDlps);
    }

    /**
     * @notice Updates the epoch size
     *
     * @param newEpochSize                new epoch size
     */
    function updateEpochSize(uint256 newEpochSize) external override onlyOwner whenCurrentEpoch {
        epochSize = newEpochSize;

        emit EpochSizeUpdated(newEpochSize);
    }

    /**
     * @notice Updates the epochRewardAmount
     *
     * @param newEpochRewardAmount                new epoch size
     */
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external override whenCurrentEpoch onlyOwner {
        epochRewardAmount = newEpochRewardAmount;

        emit EpochRewardAmountUpdated(newEpochRewardAmount);
    }

    /**
     * @notice Updates the minDlpStakeAmount
     *
     * @param newMinDlpStakeAmount                new minDlpStakeAmount
     */
    function updateMinDlpStakeAmount(uint256 newMinDlpStakeAmount) external override onlyOwner {
        minDlpStakeAmount = newMinDlpStakeAmount;

        emit MinDlpStakeAmountUpdated(newMinDlpStakeAmount);
    }

    /**
     * @notice Updates the performance percentages
     *
     * @param newTtfPercentage                new ttf percentage
     * @param newTfcPercentage                new tfc percentage
     * @param newVduPercentage                new vdu percentage
     * @param newUwPercentage                 new uw percentage
     */
    function updatePerformancePercentages(
        uint256 newTtfPercentage,
        uint256 newTfcPercentage,
        uint256 newVduPercentage,
        uint256 newUwPercentage
    ) external override onlyOwner whenCurrentEpoch {
        if (newTtfPercentage + newTfcPercentage + newVduPercentage + newUwPercentage != 100e18) {
            revert InvalidPerformancePercentages();
        }

        ttfPercentage = newTtfPercentage;
        tfcPercentage = newTfcPercentage;
        vduPercentage = newVduPercentage;
        uwPercentage = newUwPercentage;

        emit PerformancePercentagesUpdated(newTtfPercentage, newTfcPercentage, newVduPercentage, newUwPercentage);
    }

    /**
     * @notice Registers a dlp
     *
     * @param dlpAddress                   address of the dlp
     * @param dlpOwnerAddress              owner of the dlp
     * @param stakersPercentage            percentage of the rewards that will be distributed to the stakers
     */
    function registerDlp(
        address dlpAddress,
        address payable dlpOwnerAddress,
        uint256 stakersPercentage
    ) external payable override whenNotPaused nonReentrant whenCurrentEpoch {
        _registerDlp(dlpAddress, dlpOwnerAddress, stakersPercentage, false);
    }

    /**
     * @notice Registers a dlp with grant
     *
     * @param dlpAddress                   address of the dlp
     * @param dlpOwnerAddress              owner of the dlp
     * @param stakersPercentage            percentage of the rewards that will be distributed to the stakers
     */
    function registerDlpWithGrant(
        address dlpAddress,
        address payable dlpOwnerAddress,
        uint256 stakersPercentage
    ) external payable override whenNotPaused nonReentrant whenCurrentEpoch {
        _registerDlp(dlpAddress, dlpOwnerAddress, stakersPercentage, true);
    }

    /**
     * @notice Updates the stakers percentage for a dlp
     *
     * @param dlpId                        dlp id
     * @param stakersPercentage            new stakers percentage
     */
    function updateDlpStakersPercentage(
        uint256 dlpId,
        uint256 stakersPercentage
    ) external override onlyDlpOwner(dlpId) whenCurrentEpoch {
        if (stakersPercentage > 100e18) {
            revert InvalidStakersPercentage();
        }

        _dlps[dlpId].stakersPercentage = stakersPercentage;

        emit DlpStakersPercentageUpdated(dlpId, stakersPercentage);
    }

    /**
     * @notice Deregisters dlp
     *
     * @param dlpId                        dlp id
     */
    function deregisterDlp(uint256 dlpId) external override onlyDlpOwner(dlpId) nonReentrant whenCurrentEpoch {
        Dlp storage dlp = _dlps[dlpId];

        if (dlp.status != DlpStatus.Registered) {
            revert InvalidDlpStatus();
        }

        dlp.status = DlpStatus.Deregistered;

        _registeredDlps.remove(dlpId);

        emit DlpDeregistered(dlpId);

        uint256 dlpOwnerStakeAmount = dlp.stakers[dlp.ownerAddress].stakeAmountCheckpoints.latest() - dlp.grantedAmount;

        if (dlpOwnerStakeAmount > 0) {
            _unstake(dlp.ownerAddress, dlp.id, dlpOwnerStakeAmount);
        }
    }

    /**
     * @notice Distributes stake after deregistration of a granted DLP
     *
     * @param dlpId                        dlp id
     * @param dlpOwnerAmount               amount to distribute to the dlp owner
     */
    function distributeStakeAfterDeregistration(
        uint256 dlpId,
        uint256 dlpOwnerAmount
    ) external override nonReentrant whenCurrentEpoch onlyOwner {
        Dlp storage dlp = _dlps[dlpId];

        if (dlp.status != DlpStatus.Deregistered) {
            revert InvalidDlpStatus();
        }

        if (dlp.stakers[dlp.ownerAddress].stakeAmountCheckpoints.latest() == 0) {
            revert AlreadyDistributed();
        }

        if (dlpOwnerAmount > 0) {
            (bool success, ) = dlp.ownerAddress.call{value: dlpOwnerAmount}("");
            if (!success) {
                revert TransferFailed();
            }
        }

        if (dlp.grantedAmount - dlpOwnerAmount > 0) {
            (bool success, ) = owner().call{value: dlp.grantedAmount - dlpOwnerAmount}("");
            if (!success) {
                revert TransferFailed();
            }
        }

        _checkpointForcePush(dlp.stakeAmountCheckpoints, 0);
        _checkpointForcePush(dlp.stakers[dlp.ownerAddress].stakeAmountCheckpoints, 0);
    }

    /**
     * @notice Creates epochs until current block number
     */
    function createEpochs() public override {
        _createEpochsUntilBlockNumber(block.number);
    }

    /**
     * @notice Creates epochs until a specific block number
     * @dev useful only when createEpochs cannot be called because there are to many epochs to create
     *
     * @param blockNumber             block number
     */
    function createEpochsUntilBlockNumber(uint256 blockNumber) external override {
        _createEpochsUntilBlockNumber(blockNumber < block.number ? blockNumber : block.number);
    }

    /**
     * @notice Saves the performances of top DLPs for a specific epoch
     * and calculates the rewards for the DLPs
     *
     * @param epochId             The ID of the epoch
     * @param dlpPerformances     An array of DLPPerformance structs containing the performance metrics of the DLPs
     */
    function saveEpochPerformances(
        uint256 epochId,
        DlpPerformance[] memory dlpPerformances,
        bool isFinalised
    ) external override onlyOwner {
        createEpochs();

        Epoch storage epoch = _epochs[epochId];

        if (epoch.startBlock == 0) {
            revert EpochNotStarted();
        }

        if (epoch.isFinalised) {
            revert EpochFinalised();
        }

        if (isFinalised) {
            if (!_epochs[epochId - 1].isFinalised) {
                revert PreviousEpochNotFinalised();
            }
            if (epoch.endBlock > block.number) {
                revert EpochNotEnded();
            }

            epoch.isFinalised = true;
        } else {
            if (epoch.endBlock < block.number) {
                revert EpochEnded();
            }
        }

        EnumerableSet.UintSet storage epochDlpIds = _epochs[epochId].dlpIds;
        uint256 epochDlpsCount = epochDlpIds.length();

        if (epochDlpsCount != dlpPerformances.length) {
            revert ArityMismatch();
        }

        uint256 i;
        EpochDlp storage epochDlp;

        uint256 totalScore;
        for (i = 0; i < epochDlpsCount; i++) {
            epochDlp = epoch.dlps[dlpPerformances[i].dlpId];

            if (!epochDlpIds.contains(dlpPerformances[i].dlpId)) {
                revert InvalidDlpList();
            }

            epochDlp.ttf = dlpPerformances[i].ttf;
            epochDlp.tfc = dlpPerformances[i].tfc;
            epochDlp.vdu = dlpPerformances[i].vdu;
            epochDlp.uw = dlpPerformances[i].uw;

            totalScore +=
                dlpPerformances[i].ttf *
                ttfPercentage +
                dlpPerformances[i].tfc *
                tfcPercentage +
                dlpPerformances[i].vdu *
                vduPercentage +
                dlpPerformances[i].uw *
                uwPercentage;
        }

        if (totalScore == 0) {
            return;
        }

        for (i = 0; i < epochDlpsCount; i++) {
            epochDlp = epoch.dlps[dlpPerformances[i].dlpId];

            epochDlp.rewardAmount =
                ((dlpPerformances[i].ttf *
                    ttfPercentage +
                    dlpPerformances[i].tfc *
                    tfcPercentage +
                    dlpPerformances[i].vdu *
                    vduPercentage +
                    dlpPerformances[i].uw *
                    uwPercentage) * epoch.rewardAmount) /
                totalScore;

            if (isFinalised && epochDlp.stakersPercentage < 100e18) {
                (bool success, ) = _dlps[dlpPerformances[i].dlpId].ownerAddress.call{
                    value: (epochDlp.rewardAmount * (100e18 - epochDlp.stakersPercentage)) / 100e18
                }("");
                if (!success) {
                    revert TransferFailed();
                }
            }
        }

        emit EpochPerformancesSaved(epochId, isFinalised);
    }

    /**
     * @notice Adds rewards for dlps
     */
    function addRewardForDlps() external payable override nonReentrant {
        totalDlpsRewardAmount += msg.value;
    }

    /**
     * @notice Claims reward for a dlp until a specific epoch
     *
     * @param dlpId                         id of the dlp
     * @param lastEpochToClaim              epoch id
     */
    function claimRewardUntilEpoch(uint256 dlpId, uint256 lastEpochToClaim) external nonReentrant whenNotPaused {
        _claimRewardUntilEpoch(dlpId, lastEpochToClaim);
    }

    /**
     * @notice Claims reward for a dlp until the current epoch
     *
     * @param dlpId                               dlp id
     */
    function claimReward(uint256 dlpId) external nonReentrant whenNotPaused {
        _claimRewardUntilEpoch(dlpId, epochsCount);
    }

    /**
     * @notice Stakes Vana tokens for a DLP
     *
     * @param dlpId                               dlp id
     */
    function stake(uint256 dlpId) external payable override whenCurrentEpoch {
        _stake(msg.sender, dlpId, msg.value);
    }

    /**
     * @notice Unstakes Vana tokens from a DLP
     *
     * @param dlpId                               dlp id
     * @param amount                              amount to unstake
     */
    function unstake(uint256 dlpId, uint256 amount) external override whenCurrentEpoch {
        if (
            amount >
            _dlps[dlpId].stakers[msg.sender].stakeAmountCheckpoints.upperLookup(
                SafeCast.toUint48(block.number > epochSize ? block.number - epochSize : 0)
            )
        ) {
            revert InvalidUnstakeAmount();
        }

        Dlp storage dlp = _dlps[dlpId];

        if (msg.sender == dlp.ownerAddress) {
            uint256 stakeAmount = _dlps[dlpId].stakers[msg.sender].stakeAmountCheckpoints.latest();

            if (stakeAmount - amount < dlp.grantedAmount || stakeAmount - amount < minDlpStakeAmount) {
                revert InvalidUnstakeAmount();
            }
        }

        _unstake(msg.sender, dlpId, amount);
    }

    /**
     * @notice Stakes the stake for a DLP
     */
    function _stake(address stakerAddress, uint256 dlpId, uint256 amount) internal {
        Dlp storage dlp = _dlps[dlpId];

        if (dlp.status != DlpStatus.Registered) {
            revert InvalidDlpStatus();
        }

        Staker storage staker = _stakers[stakerAddress];

        staker.dlpIds.add(dlpId);

        _checkpointPush(dlp.stakeAmountCheckpoints, _add, amount);
        (uint224 pos, ) = _checkpointPush(dlp.stakers[stakerAddress].stakeAmountCheckpoints, _add, amount);

        DlpStaker storage dlpStaker = dlp.stakers[stakerAddress];

        if (pos == 0) {
            dlpStaker.lastClaimedEpochId = epochsCount;
        }

        emit Staked(stakerAddress, dlpId, amount);
    }

    /**
     * @notice Unstakes Vana tokens from a DLP
     */
    function _unstake(address stakerAddress, uint256 dlpId, uint256 amount) internal {
        Dlp storage dlp = _dlps[dlpId];

        _checkpointPush(dlp.stakeAmountCheckpoints, _subtract, amount);
        _checkpointPush(dlp.stakers[stakerAddress].stakeAmountCheckpoints, _subtract, amount);

        (bool success, ) = stakerAddress.call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit Unstaked(stakerAddress, dlpId, amount);
    }

    /**
     * @notice Registers a dlp
     *
     * @param dlpAddress                   address of the dlp
     * @param dlpOwnerAddress              owner of the dlp
     * @param stakersPercentage            percentage of the rewards that will be distributed to the stakers
     * @param granted                      true if the stake is granted
     */
    function _registerDlp(
        address dlpAddress,
        address payable dlpOwnerAddress,
        uint256 stakersPercentage,
        bool granted
    ) internal {
        if (_registeredDlps.length() >= maxNumberOfRegisteredDlps) {
            revert TooManyDlps();
        }

        if (dlpIds[dlpAddress] != 0) {
            revert InvalidDlpStatus();
        }

        if (stakersPercentage > 100e18) {
            revert InvalidStakersPercentage();
        }

        uint256 cachedDlpsCount = ++dlpsCount;
        Dlp storage dlp = _dlps[cachedDlpsCount];

        if (msg.value < minDlpStakeAmount) {
            revert InvalidStakeAmount();
        }

        if (granted) {
            dlp.grantedAmount = msg.value;
        }

        dlp.id = cachedDlpsCount;
        dlp.ownerAddress = dlpOwnerAddress;
        dlp.dlpAddress = dlpAddress;
        dlp.status = DlpStatus.Registered;
        dlp.stakersPercentage = stakersPercentage;

        dlpIds[dlpAddress] = cachedDlpsCount;

        _stake(dlpOwnerAddress, cachedDlpsCount, msg.value);

        _registeredDlps.add(cachedDlpsCount);

        emit DlpRegistered(cachedDlpsCount, dlpAddress, dlpOwnerAddress);
    }

    /**
     * @notice Claims reward for a dlp until a specific epoch
     *
     * @param dlpId                         id of the dlp
     * @param lastEpochToClaim              last epoch to claim
     */
    function _claimRewardUntilEpoch(uint256 dlpId, uint256 lastEpochToClaim) internal {
        DlpStaker storage dlpStaker = _dlps[dlpId].stakers[msg.sender];

        uint256 rewardAmount;
        uint256 totalRewardAmount;

        while (dlpStaker.lastClaimedEpochId < lastEpochToClaim) {
            Epoch storage epoch = _epochs[dlpStaker.lastClaimedEpochId + 1];
            EpochDlp storage epochDlp = epoch.dlps[dlpId];

            if (!epoch.isFinalised) {
                break;
            }

            dlpStaker.lastClaimedEpochId++;

            rewardAmount = epochDlp.stakeAmount > 0
                ? (((dlpStaker.stakeAmountCheckpoints.upperLookup(SafeCast.toUint48(epoch.startBlock - 1)) *
                    epochDlp.rewardAmount) / epochDlp.stakeAmount) * epochDlp.stakersPercentage) / 100e18
                : 0;

            if (rewardAmount == 0) {
                continue;
            }

            dlpStaker.claimAmounts[dlpStaker.lastClaimedEpochId] = rewardAmount;

            totalRewardAmount += rewardAmount;

            emit StakerDlpEpochRewardClaimed(msg.sender, dlpId, dlpStaker.lastClaimedEpochId, rewardAmount);
        }

        if (totalRewardAmount == 0) {
            revert NothingToClaim();
        }

        (bool success, ) = msg.sender.call{value: totalRewardAmount}("");
        if (!success) {
            revert TransferFailed();
        }
    }

    function _checkpointPush(
        Checkpoints.Trace208 storage store,
        function(uint208, uint208) view returns (uint208) op,
        uint256 delta
    ) private returns (uint208, uint208) {
        return store.push(SafeCast.toUint48(block.number), op(store.latest(), SafeCast.toUint208(delta)));
    }

    function _checkpointForcePush(
        Checkpoints.Trace208 storage store,
        uint256 delta
    ) private returns (uint208, uint208) {
        return store.push(SafeCast.toUint48(block.number), SafeCast.toUint208(delta));
    }

    /**
     * @notice Creates epochs until a specific block number
     *
     * @param blockNumber             block number
     */
    function _createEpochsUntilBlockNumber(uint256 blockNumber) internal {
        Epoch storage lastEpoch = _epochs[epochsCount];

        if (lastEpoch.endBlock > block.number) {
            return;
        }

        uint256[] memory topDlps = topDlpIds(numberOfTopDlps);

        while (lastEpoch.endBlock < blockNumber) {
            epochsCount++;

            Epoch storage newEpoch = _epochs[epochsCount];

            newEpoch.startBlock = lastEpoch.endBlock + 1;
            newEpoch.endBlock = newEpoch.startBlock + epochSize - 1;
            newEpoch.rewardAmount = epochRewardAmount;

            uint256 index;
            for (index = 0; index < topDlps.length; index++) {
                newEpoch.dlpIds.add(topDlps[index]);
                newEpoch.dlps[topDlps[index]].stakeAmount = _dlps[topDlps[index]].stakeAmountCheckpoints.upperLookup(
                    SafeCast.toUint48(lastEpoch.endBlock)
                );
                newEpoch.dlps[topDlps[index]].stakersPercentage = _dlps[topDlps[index]].stakersPercentage;
            }

            lastEpoch = newEpoch;

            emit EpochCreated(epochsCount);
        }
    }

    function _add(uint208 a, uint208 b) private pure returns (uint208) {
        return a + b;
    }

    function _subtract(uint208 a, uint208 b) private pure returns (uint208) {
        return a - b;
    }
}
