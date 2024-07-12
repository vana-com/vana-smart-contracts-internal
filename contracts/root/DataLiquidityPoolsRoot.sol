// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/DataLiquidityPoolsRootStorageV1.sol";

import "hardhat/console.sol";

contract DataLiquidityPoolsRoot is
UUPSUpgradeable,
PausableUpgradeable,
Ownable2StepUpgradeable,
AccessControlUpgradeable,
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
    event DlpRegistered(
        uint256 indexed dlpId,
        address indexed dlpAddress,
        address indexed ownerAddress
    );

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
    event DlpDeregisteredByOwner(
        uint256 indexed dlpId,
        uint256 unstakedAmount
    ,
        uint256 penaltyAmount
    );

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
     * @param dlpId                               id of the dlp
     * @param epochId                             epoch id
     * @param claimAmount                         amount claimed
     */
    event EpochRewardClaimed(uint256 dlpId, uint256 epochId, uint256 claimAmount);

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
    event Unstaked(
        address indexed staker,
        uint256 indexed dlpId,
        uint256 amount
    );

    error InvalidStakeAmount();
    error InvalidDlpStatus();
    error TooManyDlps();
    error NotDlpOwner();
    error WithdrawNotAllowed();
    error ArityMismatch();
    error NotAllowed();
    error InvalidScores();
    error NothingToClaim();
    error CurrentEpochNotInitialized();

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

    modifier whenCurrentEpochIsInitialized() {
        if (_epochs[epochsCount].endBlock > block.number) {
            revert CurrentEpochNotInitialized();
        }
        _;
    }

    struct InitParams {
        address payable ownerAddress;
        uint256 newMaxNumberOfDlps;
        uint256 newMinDlpStakeAmount;
        uint256 startBlock;
        uint256 newEpochSize;
        uint256 newEpochRewardAmount;
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

        maxNumberOfDlps = params.newMaxNumberOfDlps;
        minDlpStakeAmount = params.newMinDlpStakeAmount;
        epochSize = params.newEpochSize;
        epochRewardAmount = params.newEpochRewardAmount;

        Epoch storage epoch0 = _epochs[0];
        epoch0.startBlock = Math.min(params.startBlock - 1, block.number);
        epoch0.endBlock = params.startBlock - 1;

        _transferOwnership(params.ownerAddress);
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
    function version() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice Get the dlp information
     *
     * @param dlpId                         id of the dlp
     */
    function dlps(
        uint256 dlpId
    ) public view override returns (DlpResponse memory) {
        Dlp memory dlp = _dlps[dlpId];

        uint256 id;
        address dlpAddress;
        address ownerAddress;
        uint256 stakeAmount;
        DlpStatus status;
        uint256 firstBlockNumber;
        uint256 lastBlockNumber;
        uint256 grantedAmount;
        uint256 score;

        return DlpResponse({
            id: _dlps[dlpId].id,
            dlpAddress: _dlps[dlpId].dlpAddress,
            ownerAddress: _dlps[dlpId].ownerAddress,
            stakeAmount: _dlps[dlpId].stakeAmount,
            status: _dlps[dlpId].status,
            firstBlockNumber
            : _dlps[dlpId].firstBlockNumber,
            lastBlockNumber: _dlps[dlpId].lastBlockNumber,
            grantedAmount: _dlps[dlpId].grantedAmount,
            score: _dlps[dlpId].score
        });
    }

    /**
     * @notice Get the dlp information
     *
     * @param dlpAddress                         address of the dlp
     */
    function dlpsByAddress(
        address dlpAddress
    ) external view override returns (DlpResponse memory) {
        return dlps(dlpIds[dlpAddress]);
    }

    /**
     * @notice Get registered dlps list
     */
    function registeredDlps() public view override returns (uint256[] memory) {
        return _registeredDlps.values();
    }

    /**
     * @notice Get epoch information
     *
     * @param epochId                         epoch id
     */
    function epochs(
        uint256 epochId
    ) external view override returns (EpochResponse memory) {
        return EpochResponse({
            startBlock: _epochs[epochId].startBlock,
            endBlock: _epochs[epochId].endBlock,
            reward: _epochs[epochId].reward,
            dlpIds: _epochs[epochId].dlpIds.values()
        });
    }

    /**
     * @notice Get the epoch rewards
     *
     * @param epochId                              epoch id
     *
     * @return dlpIds                              dlp ids
     * @return scores                              scores
     * @return withdrawnAmounts                    withdrawnAmounts
     */
    function epochRewards(
        uint256 epochId
    )
    external
    view
    override
    returns (
        uint256[] memory dlpIds,
        uint256[] memory scores,
        uint256[] memory withdrawnAmounts
    )
    {
        Epoch storage epoch = _epochs[epochId];
        EnumerableSet.UintSet storage epochDlpIds = epoch.dlpIds;

        uint256 epochDlpsCount = epochDlpIds.length();

        dlpIds = new uint256[](epochDlpsCount);
        scores = new uint256[](epochDlpsCount);
        withdrawnAmounts = new uint256[](epochDlpsCount);


        for (uint256 i = 0; i < epochDlpsCount; i++) {
            dlpIds[i] = epochDlpIds.at(i);
            scores[i] = epoch.dlps[dlpIds[i]].score;
            withdrawnAmounts[i] = epoch.dlps[dlpIds[i]].withdrawnAmount;
        }
    }

    /**
     * @notice Get scores of all epoch dlps
     */
    function dlpScores() external view override
    returns (uint256[] memory dlpIds, uint256[] memory scores) {
        Epoch storage epoch = _epochs[epochsCount];
        EnumerableSet.UintSet storage epochDlpIds = epoch.dlpIds;

        uint256 epochDlpsCount = epochDlpIds.length();

        scores = new uint256[](epochDlpsCount);
        dlpIds = new uint256[](epochDlpsCount);

        for (uint256 i = 0; i < epochDlpsCount; i++) {
            dlpIds[i] = epochDlpIds.at(i);
            scores[i] = _dlps[i].score;
        }
    }

    function stakers(
        address staker
    ) external view override returns (uint256 totalStaked) {
        return _stakers[staker].totalStaked;
    }

    function stakedDlps(
        address staker,
        uint256 dlpId
    ) external view override returns (uint256 dlpStaked) {
        return _stakers[staker].stakedDlps[dlpId];
    }

    /**
     * @dev Pauses the contract
     */
    function pause() public override onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     */
    function unpause() public override onlyOwner {
        _unpause();
    }

    /**
     * @notice Update the maximum number of dlps
     *
     * @param newMaxNumberOfDlps           new maximum number of dlps
     */
    function updateMaxNumberOfDlps(
        uint256 newMaxNumberOfDlps
    ) external override onlyOwner {
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
    function updateEpochRewardAmount(
        uint256 newEpochRewardAmount
    ) external override onlyOwner {
        createEpochs();
        epochRewardAmount = newEpochRewardAmount;

        _epochs[epochsCount].reward = newEpochRewardAmount;

        emit EpochRewardAmountUpdated(newEpochRewardAmount);
    }

    /**
     * @notice Update the minDlpStakeAmount
     *
     * @param newMinDlpStakeAmount                new minDlpStakeAmount
     */
    function updateMinDlpStakeAmount(
        uint256 newMinDlpStakeAmount
    ) external override onlyOwner {
        minDlpStakeAmount = newMinDlpStakeAmount;

        emit MinDlpStakeAmountUpdated(newMinDlpStakeAmount);
    }

    /**
     * @notice Register a dlp
     *
     * @param dlpAddress                   address of the dlp
     * @param dlpOwnerAddress              owner of the dlp
     * @param granted                      if the dlp is granted
     */
    function registerDlp(
        address dlpAddress,
        address payable dlpOwnerAddress,
        bool granted
    ) external payable override whenNotPaused nonReentrant {
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

    /**
     * @notice Deregister dlp
     *
     * @param dlpId                        dlp id
     */
    function deregisterDlp(
        uint256 dlpId
    ) external override onlyDlpOwner(dlpId) nonReentrant {
        Dlp storage dlp = _dlps[dlpId];

        if (
            dlp.ownerAddress != msg.sender &&
            msg.sender != owner()
        ) {
            revert NotAllowed();
        }

        _deregisterDlp(dlpId);

        if (dlp.grantedAmount == 0) {
            _unstake(
                dlp.ownerAddress,
                dlp.id,
                _stakers[dlp.ownerAddress].stakedDlps[dlp.id]
            );
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
    ) external override onlyOwner nonReentrant {
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

        StakerInfo storage _stakerInfo = _stakers[dlp.ownerAddress];

        uint256 ownerStakeAmount = _stakerInfo.stakedDlps[dlp.id];
        dlp.stakeAmount -= ownerStakeAmount;

        _stakerInfo.totalStaked -= ownerStakeAmount;
        _stakerInfo.stakedDlps[dlp.id] = 0;

        if (penaltyAmount > 0) {
            payable(owner()).transfer(penaltyAmount);
        }

        if (unstakeAmount > 0) {
            payable(dlp.ownerAddress).transfer(unstakeAmount);
        }

        emit Unstaked(dlp.ownerAddress, dlp.id, unstakeAmount);
        emit DlpDeregisteredByOwner(dlpId, unstakeAmount, penaltyAmount);
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

            newEpoch.startBlock = lastEpoch.endBlock + 1;
            newEpoch.endBlock = newEpoch.startBlock + epochSize - 1;
            newEpoch.reward = epochRewardAmount;

            lastEpoch = newEpoch;

            emit EpochCreated(epochCountTemp);
        }

        epochsCount = epochCountTemp;
    }

    /**
     * @notice Set the scores for the dlps
     */
    function updateScores(
        uint256[] memory dlps,
        uint256[] memory scores
    ) external override onlyOwner {
        createEpochs();

        Epoch storage epoch = _epochs[epochsCount];
        EnumerableSet.UintSet storage epochDlpIds = epoch.dlpIds;

        uint256 length = dlps.length;

        if (
            length != scores.length ||
            length != epochDlpIds.length()
        ) {
            revert ArityMismatch();
        }

        uint256 totalScore = 0;
        for (uint256 i = 0; i < length; i++) {
            Dlp storage dlp = _dlps[dlps[i]];

            if (!epochDlpIds.contains(dlp.id)) {
                revert InvalidDlpStatus();
            }

            dlp.score = scores[i];
            totalScore += scores[i];
        }

        if (totalScore != 1e18) {
            revert InvalidScores();
        }

        emit ScoresUpdated(dlps, scores);
    }

    /**
     * @notice Add rewards for dlps
     */
    function addRewardForDlps() external payable override nonReentrant {
        totalDlpsRewardAmount += msg.value;
    }

    function claimUnsentReward(
        uint256

        dlpId,
        uint256 epochNumber
    ) external onlyDlpOwner(dlpId) {
        Epoch storage epoch = _epochs[epochNumber];
        EpochDlp storage epochDlps = epoch.dlps[dlpId];

        Dlp storage dlp = _dlps[dlpId];

        uint256 dlpRewardAmount = (epochDlps.score * epoch.reward) / 1e18;

        if (dlpRewardAmount <= epochDlps.withdrawnAmount) {
            revert NothingToClaim();
        }

        uint256 unclaimedReward = dlpRewardAmount - epochDlps.withdrawnAmount;

        if (totalDlpsRewardAmount > unclaimedReward) {
            epoch.dlps[dlpId].withdrawnAmount = dlpRewardAmount;
            totalDlpsRewardAmount -= unclaimedReward;
            dlp.ownerAddress.transfer(unclaimedReward);

            emit EpochRewardClaimed(dlpId, epochNumber, unclaimedReward);
        }
    }

    function stake(uint256 dlpId) public payable override {
        _addStake(msg.sender, dlpId, msg.value);
    }

    function _deregisterDlp(uint256 dlpId) internal {
        createEpochs();

        Dlp storage dlp = _dlps[dlpId];

        if (dlp.status != DlpStatus.Registered) {
            revert InvalidDlpStatus();
        }

        dlp.status = DlpStatus.Deregistered;
        dlp.lastBlockNumber = block.number;

        _registeredDlps.remove(dlpId);

        emit DlpDeregistered(dlpId);
    }

    /**
     * @notice Set the emission scores for the dlps
     *
     * @param epochNumber                   epoch number
     */
    function _setEmissionScores(uint256 epochNumber) internal {
        EnumerableSet.UintSet storage epochDlpIds = _epochs[epochNumber].dlpIds;

        uint256 epochDlpsCount = epochDlpIds.length();

        Epoch storage epoch = _epochs[epochNumber];
        for (uint256 i = 0; i < epochDlpsCount; i++) {
            uint256 dlpId = epochDlpIds.at(i);
            Dlp storage dlp = _dlps[dlpId];
            uint256 dlpRewardAmount = (dlp.score * epoch.reward) / 1e18;

            EpochDlp storage epochDlps = epoch.dlps[dlpId];

            epochDlps.score = dlp.score;

            //send the reward to the dlps
            if (
                dlpRewardAmount > 0 && totalDlpsRewardAmount > dlpRewardAmount
            ) {
                epochDlps.withdrawnAmount = dlpRewardAmount;
                totalDlpsRewardAmount -= dlpRewardAmount;
                dlp.ownerAddress.transfer(dlpRewardAmount);
            }
        }
    }

    function _addStake(
        address stakerAddress,
        uint256 dlpId,
        uint256 amount
    ) internal {
        StakerInfo storage _stakerInfo = _stakers[stakerAddress];

        _stakerInfo.totalStaked += amount;
        _stakerInfo.stakedDlps[dlpId] += amount;

        Dlp storage dlp = _dlps[dlpId];
        dlp.stakeAmount += amount;

        emit Staked(stakerAddress, dlpId, amount);
    }

    function _unstake(
        address stakerAddress,
        uint256 dlpId,
        uint256 amount
    ) internal {
        StakerInfo storage _stakerInfo = _stakers[stakerAddress];

        _stakerInfo.totalStaked -= amount;
        _stakerInfo.stakedDlps[dlpId] -= amount;

        Dlp storage dlp = _dlps[dlpId];
        dlp.stakeAmount -= amount;

        payable(stakerAddress).transfer(amount);

        emit Unstaked(stakerAddress, dlpId, amount);
    }

    function _selectTopStakedDlps() internal returns(uint256[] memory topDlps) {
        uint256[] memory dlps = _registeredDlps.values();
        uint256 dlpsCount = dlps.length;

        if (dlpsCount <= maxNumberOfDlps) {
            return dlps;
        }

        topDlps = new uint256[](maxNumberOfDlps);

        uint256[] memory stakedAmounts = new uint256[](dlpsCount);

    }
}
