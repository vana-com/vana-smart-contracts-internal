// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
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
     * @notice Triggered when a dlp has been deregistered by the dlp owner
     *
     * @param dlpId                              id of the dlp
     * @param unstakedAmount                     amount unstaked
     * @param penaltyAmount                      penalty amount
     */
    event DlpDeregisteredByOwner(uint256 indexed dlpId, uint256 unstakedAmount, uint256 penaltyAmount);

    /**
     * @notice Triggered when a epoch has been created
     *
     * @param epochId                  reward epoch id
     */
    event EpochCreated(uint256 epochId);

    /**
     * @notice Triggered when owner has updated its scores
     *
     * @param dlpIds                       dlp ids
     * @param scores                       dlp scores
     */
    event ScoresUpdated(uint256[] dlpIds, uint256[] scores);

    /**
     * @notice Triggered when the max number of dlps has been updated
     *
     * @param newMaxNumberOfDlps           new max number of dlps
     */
    event MaxNumberOfDlpsUpdated(uint256 newMaxNumberOfDlps);

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
     * @notice Triggered when a dlp has claimed un unsent reward
     *
     * @param staker                              address of the staker
     * @param epochId                             epoch id
     * @param dlpId                               id of the dlp
     * @param claimAmount                         amount claimed
     */
    event EpochRewardClaimed(address staker, uint256 epochId, uint256 dlpId, uint256 claimAmount);

    /**
     * @notice Triggered when user has staked some DAT for a DLP
     *
     * @param staker                            address of the staker
     * @param dlpId                             id of the dlp
     * @param amount                            amount staked
     */
    event Staked(address indexed staker, uint256 indexed dlpId, uint256 amount);

    /**
     * @notice Triggered when user has unstaked some DAT from a DLP
     *
     * @param staker                            address of the staker
     * @param dlpId                             id of the dlp
     * @param amount                            amount unstaked
     */
    event Unstaked(address indexed staker, uint256 indexed dlpId, uint256 amount);

    /**
     * @notice Triggered when epoch performances have been saved
     *
     * @param epochId                         epoch id
     * @param isFinal                           true if the performances are final
     */
    event EpochPerformancesSaved(uint256 epochId, bool isFinal);

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

    error InvalidStakeAmount();
    error InvalidUnstakeAmount();
    error InvalidDlpStatus();
    error TooManyDlps();
    error NotDlpOwner();
    error WithdrawNotAllowed();
    error ArityMismatch();
    error NotAllowed();
    error InvalidPerformances();
    error NothingToClaim();
    error CurrentEpochNotCreated();
    error EpochPerformancesAlreadySet();
    error InvalidPerformancePercentages();
    error NextEpochCannotBeCreated();
    error InvalidEpochStatus();

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

    modifier whenCurrentEpoch() {
        if (_epochs[epochsCount].endBlock < block.number) {
            revert CurrentEpochNotCreated();
        }
        _;
    }

    struct InitParams {
        address payable ownerAddress;
        uint256 maxNumberOfDlps;
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

        maxNumberOfDlps = params.maxNumberOfDlps;
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
        epoch0.status = EpochStatus.Finished;

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
     * @notice Get the dlp information
     *
     * @param dlpId                         id of the dlp
     */
    function dlps(uint256 dlpId) public view override returns (DlpResponse memory) {
        Dlp memory dlp = _dlps[dlpId];

        return
            DlpResponse({
                id: dlp.id,
                dlpAddress: dlp.dlpAddress,
                ownerAddress: dlp.ownerAddress,
                stakeAmount: dlp.stakeAmount,
                status: dlp.status,
                registrationBlockNumber: dlp.registrationBlockNumber,
                grantedAmount: dlp.grantedAmount
            });
    }

    /**
     * @notice Get the dlp information
     *
     * @param dlpAddress                         address of the dlp
     */
    function dlpsByAddress(address dlpAddress) external view override returns (DlpResponse memory) {
        return dlps(dlpIds[dlpAddress]);
    }

    /**
     * @notice Get registered dlps list
     */
    function registeredDlps() external view override returns (uint256[] memory) {
        return _registeredDlps.values();
    }

    /**
     * @notice Get epoch information
     *
     * @param epochId                         epoch id
     */
    function epochs(uint256 epochId) external view override returns (EpochResponse memory) {
        return
            EpochResponse({
                startBlock: _epochs[epochId].startBlock,
                endBlock: _epochs[epochId].endBlock,
                reward: _epochs[epochId].reward,
                dlpIds: _epochs[epochId].dlpIds.values()
            });
    }

    /**
     * @notice Get epoch dlp information
     *
     * @param epochId                         epoch id
     * @param dlpId                           id of the dlp
     */
    function epochDlps(uint256 epochId, uint256 dlpId) external view override returns (EpochDlp memory) {
        return _epochs[epochId].dlps[dlpId];
    }

    /**
     * @notice Get the staker information
     *
     * @param staker                         address of the staker
     */
    function stakers(address staker) external view override returns (uint256) {
        return _stakers[staker].totalStaked;
    }

    /**
     * @notice Get the dlp stakers
     *
     * @param staker                        address of the staker
     * @param dlpId                         id of the dlp
     */
    function stakerDlps(address staker, uint256 dlpId) external view override returns (uint256) {
        return _stakers[staker].dlps[dlpId].stakedAmount;
    }

    /**
     * @notice Get the staker epoch dlp
     *
     * @param staker                          address of the staker
     * @param epochId                         epoch id
     * @param dlpId                           id of the dlp
     */
    function stakerDlpEpochs(
        address staker,
        uint256 dlpId,
        uint256 epochId
    ) external view override returns (StakerDlpEpoch memory) {
        return _stakers[staker].dlps[dlpId].epochs[epochId];
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
     * @notice Update the maximum number of dlps
     *
     * @param newMaxNumberOfDlps           new maximum number of dlps
     */
    function updateMaxNumberOfDlps(uint256 newMaxNumberOfDlps) external override onlyOwner {
        maxNumberOfDlps = newMaxNumberOfDlps;

        emit MaxNumberOfDlpsUpdated(newMaxNumberOfDlps);
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
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external override whenCurrentEpoch onlyOwner {
        epochRewardAmount = newEpochRewardAmount;

        emit EpochRewardAmountUpdated(newEpochRewardAmount);
    }

    /**
     * @notice Update the minDlpStakeAmount
     *
     * @param newMinDlpStakeAmount                new minDlpStakeAmount
     */
    function updateMinDlpStakeAmount(uint256 newMinDlpStakeAmount) external override onlyOwner {
        minDlpStakeAmount = newMinDlpStakeAmount;

        emit MinDlpStakeAmountUpdated(newMinDlpStakeAmount);
    }

    /**
     * @notice Update the performance percentages
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
    ) external override onlyOwner {
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
     * @notice Register a dlp
     *
     * @param dlpAddress                   address of the dlp
     * @param dlpOwnerAddress              owner of the dlp
     */
    function registerDlp(
        address dlpAddress,
        address payable dlpOwnerAddress
    ) external payable override whenNotPaused nonReentrant whenCurrentEpoch {
        _registerDlp(dlpAddress, dlpOwnerAddress, false);
    }

    /**
     * @notice Register a dlp with grant
     *
     * @param dlpAddress                   address of the dlp
     * @param dlpOwnerAddress              owner of the dlp
     */
    function registerDlpWithGrant(
        address dlpAddress,
        address payable dlpOwnerAddress
    ) external payable override whenNotPaused nonReentrant whenCurrentEpoch {
        _registerDlp(dlpAddress, dlpOwnerAddress, true);
    }

    function updateDlpStakersPercentage(
        uint256 dlpId,
        uint256 stakersPercentage
    ) external override onlyDlpOwner(dlpId) whenCurrentEpoch {
        _dlps[dlpId].stakersPercentage = stakersPercentage;
    }

    /**
     * @notice Deregister dlp
     *
     * @param dlpId                        dlp id
     */
    function deregisterDlp(uint256 dlpId) external override onlyDlpOwner(dlpId) nonReentrant whenCurrentEpoch {
        Dlp storage dlp = _dlps[dlpId];

        _deregisterDlp(dlpId);

        if (dlp.grantedAmount == 0) {
            _unstake(dlp.ownerAddress, dlp.id, _stakers[dlp.ownerAddress].dlps[dlpId].stakedAmount);
        }
    }

    /**
     * @notice Deregister dlp and withdraw stake amount
     *
     * @param dlpId                             dlp id
     * @param unstakeAmount                     amount to sent to dlp owner
     */
    function deregisterDlpByOwner(
        uint256 dlpId,
        uint256 unstakeAmount
    ) external override nonReentrant whenCurrentEpoch onlyOwner {
        Dlp storage dlp = _dlps[dlpId];

        if (unstakeAmount > dlp.stakeAmount) {
            revert InvalidStakeAmount();
        }

        if (dlp.status == DlpStatus.Registered) {
            _deregisterDlp(dlpId);
        }

        if (dlp.status != DlpStatus.Deregistered) {
            revert InvalidDlpStatus();
        }

        uint256 penaltyAmount = dlp.stakeAmount - unstakeAmount;

        Staker storage staker = _stakers[dlp.ownerAddress];

        uint256 ownerStakeAmount = staker.dlps[dlpId].stakedAmount;
        dlp.stakeAmount -= ownerStakeAmount;

        staker.totalStaked -= ownerStakeAmount;
        staker.dlps[dlp.id].stakedAmount = 0;
        staker.dlps[dlp.id].epochs[epochsCount].stakedAmount = 0;

        if (penaltyAmount > 0) {
            payable(owner()).transfer(penaltyAmount);
        }

        if (unstakeAmount > 0) {
            payable(dlp.ownerAddress).transfer(unstakeAmount);
        }

        emit Unstaked(dlp.ownerAddress, dlp.id, unstakeAmount);
        emit DlpDeregisteredByOwner(dlpId, unstakeAmount, penaltyAmount);
    }

    function createNextEpoch() public override {
        Epoch storage lastEpoch = _epochs[epochsCount];

        if (lastEpoch.endBlock > block.number) {
            return;
        }

        if (epochsCount > 0 && _epochs[epochsCount - 1].status != EpochStatus.Finished) {
            revert NextEpochCannotBeCreated();
        }

        epochsCount++;

        Epoch storage newEpoch = _epochs[epochsCount];

        newEpoch.startBlock = lastEpoch.endBlock + 1;
        newEpoch.endBlock = newEpoch.startBlock + epochSize - 1;
        newEpoch.reward = epochRewardAmount;
        newEpoch.status = EpochStatus.Created;

        uint256 index;
        uint256[] memory topDlps = getTopDlpsIds(maxNumberOfDlps);
        for (index = 0; index < topDlps.length; index++) {
            newEpoch.dlpIds.add(topDlps[index]);
            newEpoch.dlps[topDlps[index]].stakedAmount = _dlps[topDlps[index]].stakeAmount;
            newEpoch.dlps[topDlps[index]].stakersPercentage = _dlps[topDlps[index]].stakersPercentage;
        }

        emit EpochCreated(epochsCount);
    }

    /**
     * @notice Saves the performances of top DLPs for a specific epoch
     *
     * @param epochId             The ID of the epoch
     * @param dlpPerformances     An array of DLPPerformance structs containing the performance metrics of the DLPs
     */
    function saveEpochPerformances(
        uint256 epochId,
        DlpPerformance[] memory dlpPerformances,
        bool isFinal
    ) external override onlyOwner {
        createNextEpoch();

        Epoch storage epoch = _epochs[epochId];

        if (epoch.status != EpochStatus.Created) {
            revert InvalidEpochStatus();
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
                revert InvalidPerformances();
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

            if (epochDlp.rewardAmount > 0) {
                revert EpochPerformancesAlreadySet();
            }

            epochDlp.rewardAmount =
                ((dlpPerformances[i].ttf *
                    ttfPercentage +
                    dlpPerformances[i].tfc *
                    tfcPercentage +
                    dlpPerformances[i].vdu *
                    vduPercentage +
                    dlpPerformances[i].uw *
                    uwPercentage) * epoch.reward) /
                totalScore;

            if (epochDlp.stakersPercentage < 100e18) {
                payable(_dlps[dlpPerformances[i].dlpId].ownerAddress).transfer(
                    (epochDlp.rewardAmount * (100e18 - epochDlp.stakersPercentage)) / 100e18
                );
            }
        }

        if (isFinal) {
            epoch.status = EpochStatus.Finished;
        }

        emit EpochPerformancesSaved(epochId, isFinal);
    }

    /**
     * @notice Add rewards for dlps
     */
    function addRewardForDlps() external payable override nonReentrant {
        totalDlpsRewardAmount += msg.value;
    }

    /**
     * @notice Staker claim reward for a dlp in an epoch
     *
     * @param epochNumber                         epoch number
     * @param dlpId                               dlp id
     */
    function claimReward(uint256 epochNumber, uint256 dlpId) external nonReentrant {
        uint256 epochDlpReward = _epochs[epochNumber].dlps[dlpId].rewardAmount;

        StakerDlp storage stakerDlp = _stakers[msg.sender].dlps[dlpId];
        StakerDlpEpoch storage stakerDlpEpoch = stakerDlp.epochs[epochNumber];

        uint256 stakedAmountBeforeCurrentEpoch = stakerDlp.stakedAmount - stakerDlpEpoch.stakedAmount;

        if (stakedAmountBeforeCurrentEpoch == 0 || stakerDlpEpoch.withdrawnReward > 0 || epochDlpReward == 0) {
            revert NothingToClaim();
        }

        Epoch storage epoch = _epochs[epochNumber];
        EpochDlp storage epochDlp = epoch.dlps[dlpId];

        uint256 rewardAmount = (((stakedAmountBeforeCurrentEpoch * epochDlpReward) / epochDlp.stakedAmount) *
            epochDlp.stakersPercentage) / 100e18;

        stakerDlpEpoch.withdrawnReward = rewardAmount;

        payable(msg.sender).transfer(rewardAmount);

        emit EpochRewardClaimed(msg.sender, epochNumber, dlpId, rewardAmount);
    }

    function stake(uint256 dlpId) external payable override whenCurrentEpoch {
        _addStake(msg.sender, dlpId, msg.value);
    }

    function unstake(uint256 dlpId, uint256 amount) external override whenCurrentEpoch {
        StakerDlp storage stakerDlp = _stakers[msg.sender].dlps[dlpId];
        if (amount > stakerDlp.stakedAmount) {
            revert InvalidUnstakeAmount();
        }

        Dlp storage dlp = _dlps[dlpId];

        if (
            msg.sender == dlp.ownerAddress &&
            (stakerDlp.stakedAmount - amount < dlp.grantedAmount || stakerDlp.stakedAmount - amount < minDlpStakeAmount)
        ) {
            revert InvalidUnstakeAmount();
        }

        _unstake(msg.sender, dlpId, amount);
    }

    /**
     * @notice Allows the owner to withdraw tokens from the contract
     *
     * @param _token    address of the token to withdraw use address(0) for VANA
     * @param _to       address where the token will be send
     * @param _amount   amount to withdraw
     */
    function withdraw(
        address _token,
        address _to,
        uint256 _amount
    ) external override onlyOwner nonReentrant returns (bool success) {
        if (_token == address(0)) {
            (success, ) = _to.call{value: _amount}("");
            return success;
        } else {
            IERC20(_token).safeTransfer(_to, _amount);
            success = true;
        }
    }

    function _deregisterDlp(uint256 dlpId) internal {
        Dlp storage dlp = _dlps[dlpId];

        if (dlp.status != DlpStatus.Registered) {
            revert InvalidDlpStatus();
        }

        dlp.status = DlpStatus.Deregistered;

        _registeredDlps.remove(dlpId);

        emit DlpDeregistered(dlpId);
    }

    function _addStake(address stakerAddress, uint256 dlpId, uint256 amount) internal {
        Dlp storage dlp = _dlps[dlpId];

        if (dlp.status != DlpStatus.Registered) {
            revert InvalidDlpStatus();
        }
        dlp.stakeAmount += amount;

        Staker storage staker = _stakers[stakerAddress];

        staker.totalStaked += amount;
        staker.dlps[dlpId].stakedAmount += amount;
        staker.dlps[dlpId].epochs[epochsCount].stakedAmount += amount;

        emit Staked(stakerAddress, dlpId, amount);
    }

    function _unstake(address stakerAddress, uint256 dlpId, uint256 amount) internal {
        Staker storage staker = _stakers[stakerAddress];

        staker.totalStaked -= amount;
        staker.dlps[dlpId].stakedAmount -= amount;
        if (staker.dlps[dlpId].epochs[epochsCount].stakedAmount > amount) {
            staker.dlps[dlpId].epochs[epochsCount].stakedAmount -= amount;
        } else {
            staker.dlps[dlpId].epochs[epochsCount].stakedAmount = 0;
        }

        _dlps[dlpId].stakeAmount -= amount;

        payable(stakerAddress).transfer(amount);

        emit Unstaked(stakerAddress, dlpId, amount);
    }

    function getTopDlpsIds(uint256 numberOfDlps) public view override returns (uint256[] memory) {
        uint256[] memory registeredDlpIds = _registeredDlps.values();
        uint256 dlpsCount = registeredDlpIds.length;

        numberOfDlps = Math.min(numberOfDlps, dlpsCount);

        uint256[] memory topDlpIds = new uint256[](numberOfDlps);

        if (numberOfDlps == 0) {
            return topDlpIds;
        }

        uint256 index;
        uint256 position;

        topDlpIds[0] = registeredDlpIds[0];

        Dlp storage currentDlp;
        Dlp storage previousDlp;

        for (index = 1; index < numberOfDlps; index++) {
            position = index;

            currentDlp = _dlps[registeredDlpIds[index]];
            previousDlp = _dlps[topDlpIds[position - 1]];

            while (
                previousDlp.stakeAmount < currentDlp.stakeAmount ||
                (previousDlp.stakeAmount == currentDlp.stakeAmount && previousDlp.id > currentDlp.id)
            ) {
                topDlpIds[position] = topDlpIds[position - 1];
                position--;

                if (position == 0) {
                    break;
                } else {
                    previousDlp = _dlps[topDlpIds[position - 1]];
                }
            }

            topDlpIds[position] = registeredDlpIds[index];
        }

        for (index = numberOfDlps; index < dlpsCount; index++) {
            position = numberOfDlps - 1;

            currentDlp = _dlps[registeredDlpIds[index]];
            previousDlp = _dlps[topDlpIds[position]];

            if (
                previousDlp.stakeAmount > currentDlp.stakeAmount ||
                (previousDlp.stakeAmount == currentDlp.stakeAmount && previousDlp.id < currentDlp.id)
            ) {
                continue;
            }

            previousDlp = _dlps[topDlpIds[position - 1]];

            while (
                previousDlp.stakeAmount < currentDlp.stakeAmount ||
                (previousDlp.stakeAmount == currentDlp.stakeAmount && previousDlp.id > currentDlp.id)
            ) {
                topDlpIds[position] = topDlpIds[position - 1];
                position--;

                if (position == 0) {
                    break;
                } else {
                    previousDlp = _dlps[topDlpIds[position - 1]];
                }
            }

            topDlpIds[position] = registeredDlpIds[index];
        }

        return topDlpIds;
    }

    function _registerDlp(address dlpAddress, address payable dlpOwnerAddress, bool granted) internal {
        if (dlpIds[dlpAddress] != 0) {
            revert InvalidDlpStatus();
        }

        dlpsCount++;
        Dlp storage dlp = _dlps[dlpsCount];

        if (msg.value < minDlpStakeAmount) {
            revert InvalidStakeAmount();
        }

        if (granted) {
            dlp.grantedAmount = msg.value;
        }

        dlp.id = dlpsCount;
        dlp.ownerAddress = dlpOwnerAddress;
        dlp.dlpAddress = dlpAddress;
        dlp.status = DlpStatus.Registered;

        dlpIds[dlpAddress] = dlpsCount;

        _addStake(dlpOwnerAddress, dlpsCount, msg.value);

        _registeredDlps.add(dlpsCount);

        emit DlpRegistered(dlpsCount, dlpAddress, dlpOwnerAddress);
    }
}
