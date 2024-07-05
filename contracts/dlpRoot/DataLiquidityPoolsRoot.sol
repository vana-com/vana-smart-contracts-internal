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
     * @param dlpAddress                   address of the dlp
     * @param ownerAddress                       owner of the dlp
     * @param amount                             amount staked in this call
     */
    event DlpRegistered(
        address indexed dlpAddress,
        address indexed ownerAddress,
        uint256 amount
    );

    /**
     * @notice Triggered when a dlp has been unregistered
     *
     * @param dlpAddress                   address of the dlp
     */
    event DlpUnregistered(address indexed dlpAddress);

    /**
     * @notice Triggered when a dlp has been approved
     *
     * @param dlpAddress                   address of the dlp
     */
    event DlpApproved(address indexed dlpAddress);

    /**
     * @notice Triggered when a dlp has been deregistered
     *
     * @param dlpAddress                   address of the dlp
     */
    event DlpDeregistered(address indexed dlpAddress);

    /**
     * @notice Triggered when a dlp has been deregistered by the dlp owner
     *
     * @param dlpAddress                   address of the dlp
     * @param unstakedAmmount                    amount unstaked
     * @param penaltyAmount                      penalty amount
     */
    event DlpDeregisteredByOwner(
        address indexed dlpAddress,
        uint256 unstakedAmmount,
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
     * @param dlps                         dlps
     * @param scores                       dlp scores
     */
    event ScoresUpdated(address[] dlps, uint256[] scores);

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
     * @notice Triggered when the minStakeAmount has been updated
     *
     * @param newMinStakeAmount                new minStakeAmount
     */
    event MinStakeAmountUpdated(uint256 newMinStakeAmount);

    /**
     * @notice Triggered when a dlp has claimed un unsed reward
     *
     * @param dlp                           address of the dlp
     * @param epochId                             epcoch id
     * @param claimAmount                         amount claimed
     */
    event EpochRewardClaimed(address dlp, uint256 epochId, uint256 claimAmount);

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

    /**
     * @dev Modifier to make a function callable only when the caller is the owner of the dlp
     *
     * @param dlpAddress                         address of the dlp
     */
    modifier onlyDlpOwner(address dlpAddress) {
        if (_dlpsInfo[dlpAddress].ownerAddress != msg.sender) {
            revert NotDlpOwner();
        }
        _;
    }

    struct InitParams {
        address payable ownerAddress;
        uint256 newMaxNumberOfDlps;
        uint256 newMinStakeAmount;
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
        minStakeAmount = params.newMinStakeAmount;
        epochSize = params.newEpochSize;
        epochRewardAmount = params.newEpochRewardAmount;

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
     * @param index                         index of the dlp
     */
    function dlps(
        uint256 index
    ) external view override returns (DlpInfoResponse memory) {
        return dlpsInfo(_dlps[index]);
    }

    /**
     * @notice Get the dlp information
     *
     * @param dlpAddress                         address of the dlp
     */
    function dlpsInfo(
        address dlpAddress
    ) public view override returns (DlpInfoResponse memory) {
        return
            DlpInfoResponse(
                _dlpsInfo[dlpAddress].id,
                dlpAddress,
                _dlpsInfo[dlpAddress].ownerAddress,
                _dlpsInfo[dlpAddress].stakeAmount,
                _dlpsInfo[dlpAddress].status,
                _dlpsInfo[dlpAddress].firstBlockNumber,
                _dlpsInfo[dlpAddress].lastBlockNumber,
                _dlpsInfo[dlpAddress].grantedAmount,
                _dlpsInfo[dlpAddress].score
            );
    }

    /**
     * @notice Get active dlps list by listId
     */
    function activeDlpsLists(
        uint256 listId
    ) public view override returns (address[] memory) {
        return _activeDlpsLists[listId].values();
    }

    /**
     * @notice Get epoch information
     *
     * @param epochId                         epoch id
     */
    function epochs(
        uint256 epochId
    ) external view override returns (EpochResponse memory) {
        return
            EpochResponse(
                _epochs[epochId].startBlock,
                _epochs[epochId].endBlock,
                _epochs[epochId].reward,
                _epochs[epochId].dlpsListId
            );
    }

    /**
     * @notice Get the epoch rewards
     *
     * @param epochId                              epoch id
     *
     * @return dlps                                dlps
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
            address[] memory dlps,
            uint256[] memory scores,
            uint256[] memory withdrawnAmounts
        )
    {
        EnumerableSet.AddressSet storage epochDlps = _activeDlpsLists[
            _epochs[epochId].dlpsListId
        ];

        uint256 epochDlpsCount = epochDlps.length();

        dlps = new address[](epochDlpsCount);
        scores = new uint256[](epochDlpsCount);
        withdrawnAmounts = new uint256[](epochDlpsCount);

        Epoch storage epoch = _epochs[epochId];

        for (uint256 i = 0; i < epochDlpsCount; i++) {
            dlps[i] = epochDlps.at(i);
            scores[i] = epoch.dlpRewards[dlps[i]].score;
            withdrawnAmounts[i] = epoch.dlpRewards[dlps[i]].withdrawnAmount;
        }
    }

    /**
     * @notice Get scores of all active dlps
     */
    function dlpScores()
        external
        view
        override
        returns (address[] memory dlps, uint256[] memory scores)
    {
        EnumerableSet.AddressSet storage epochDlps = _activeDlpsLists[
            _epochs[epochsCount].dlpsListId
        ];

        uint256 epochDlpsCount = epochDlps.length();

        scores = new uint256[](epochDlpsCount);
        dlps = new address[](epochDlpsCount);

        for (uint256 i = 0; i < epochDlpsCount; i++) {
            dlps[i] = epochDlps.at(i);
            scores[i] = _dlpsInfo[dlps[i]].score;
        }
    }

    function stakers(
        address staker
    ) external view override returns (uint256 totalStaked) {
        return _stakersInfo[staker].totalStaked;
    }

    function stakedDlps(
        address staker,
        uint256 dlpId
    ) external view override returns (uint256 dlpStaked) {
        return _stakersInfo[staker].stakedDlps[dlpId];
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
     * @notice Update the minStakeAmount
     *
     * @param newMinStakeAmount                new minStakeAmount
     */
    function updateMinStakeAmount(
        uint256 newMinStakeAmount
    ) external override onlyOwner {
        minStakeAmount = newMinStakeAmount;

        emit MinStakeAmountUpdated(newMinStakeAmount);
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
    ) external payable override whenNotPaused nonReentrant {
        DlpInfo storage dlp = _dlpsInfo[dlpAddress];

        if (dlp.status != DlpStatus.None) {
            revert InvalidDlpStatus();
        }

        if (msg.value < minStakeAmount) {
            revert InvalidStakeAmount();
        }

        if (msg.sender == owner()) {
            dlp.grantedAmount = msg.value;
        }

        dlpsCount++;
        _dlps[dlpsCount] = dlpAddress;

        dlp.id = dlpsCount;
        dlp.ownerAddress = dlpOwnerAddress;
        dlp.status = DlpStatus.Registered;

        _addStake(dlpOwnerAddress, dlpsCount, msg.value);

        emit DlpRegistered(dlpAddress, dlpOwnerAddress, msg.value);
    }

    function approveDlp(address dlpAddress) external override onlyOwner {
        createEpochs();
        uint256 index;

        EnumerableSet.AddressSet storage activeDlpsList = _activeDlpsLists[
            activeDlpsListsCount
        ];
        uint256 activeDlpsListCount = activeDlpsList.length();

        activeDlpsListsCount++;

        EnumerableSet.AddressSet storage newActiveDlpsList = _activeDlpsLists[
            activeDlpsListsCount
        ];

        for (index = 0; index < activeDlpsListCount; index++) {
            newActiveDlpsList.add(activeDlpsList.at(index));
        }

        DlpInfo storage dlp = _dlpsInfo[dlpAddress];

        if (dlp.status != DlpStatus.Registered) {
            revert InvalidDlpStatus();
        }

        newActiveDlpsList.add(dlpAddress);

        dlp.status = DlpStatus.Active;
        dlp.firstBlockNumber = block.number;

        _epochs[epochsCount].dlpsListId = activeDlpsListsCount;

        emit DlpApproved(dlpAddress);
    }

    /**
     * @notice Deregister dlp
     *
     * @param dlpAddress                        dlp addresses
     */
    function deregisterDlp(
        address dlpAddress
    ) external override onlyDlpOwner(dlpAddress) nonReentrant {
        if (
            _dlpsInfo[dlpAddress].ownerAddress != msg.sender &&
            msg.sender != owner()
        ) {
            revert NotAllowed();
        }

        _deregisterDlp(dlpAddress);

        DlpInfo storage dlp = _dlpsInfo[dlpAddress];

        if (dlp.grantedAmount == 0) {
            _unstake(
                dlp.ownerAddress,
                dlp.id,
                _stakersInfo[dlp.ownerAddress].stakedDlps[dlp.id]
            );
        }
    }

    /**
     * @notice Deregister dlp and withdraw stake amount
     *
     * @param dlpAddress                        dlp addresses
     * @param unstakeAmount                     amount to sent to dlp owner
     */
    function deregisterDlpByOwner(
        address dlpAddress,
        uint256 unstakeAmount
    ) external override onlyOwner nonReentrant {
        DlpInfo storage dlp = _dlpsInfo[dlpAddress];

        if (unstakeAmount > dlp.stakeAmount) {
            revert InvalidStakeAmount();
        }

        if (
            dlp.status == DlpStatus.Active || dlp.status == DlpStatus.Registered
        ) {
            _deregisterDlp(dlpAddress);
        }

        if (dlp.status != DlpStatus.Deregistered) {
            revert InvalidDlpStatus();
        }

        uint256 penaltyAmount = dlp.stakeAmount - unstakeAmount;

        StakerInfo storage _stakerInfo = _stakersInfo[dlp.ownerAddress];

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
        emit DlpDeregisteredByOwner(dlpAddress, unstakeAmount, penaltyAmount);
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

            newEpoch.dlpsListId = lastEpoch.dlpsListId;
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
        address[] memory dlps,
        uint256[] memory scores
    ) external override onlyOwner {
        createEpochs();

        uint256 length = dlps.length;

        if (
            length != scores.length ||
            length != _activeDlpsLists[activeDlpsListsCount].length()
        ) {
            revert ArityMismatch();
        }

        uint256 totalScore = 0;
        for (uint256 i = 0; i < length; i++) {
            DlpInfo storage dlp = _dlpsInfo[dlps[i]];

            if (dlp.status != DlpStatus.Active) {
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
        address dlpAddress,
        uint256 epochNumber
    ) external onlyDlpOwner(dlpAddress) {
        Epoch storage epoch = _epochs[epochNumber];
        DlpReward storage dlpReward = epoch.dlpRewards[dlpAddress];

        DlpInfo storage dlp = _dlpsInfo[dlpAddress];

        uint256 dlpRewardAmount = (dlpReward.score * epoch.reward) / 1e18;

        if (dlpRewardAmount <= dlpReward.withdrawnAmount) {
            revert NothingToClaim();
        }

        uint256 unclaimedReward = dlpRewardAmount - dlpReward.withdrawnAmount;

        if (totalDlpsRewardAmount > unclaimedReward) {
            epoch.dlpRewards[dlpAddress].withdrawnAmount = dlpRewardAmount;
            totalDlpsRewardAmount -= unclaimedReward;
            dlp.ownerAddress.transfer(unclaimedReward);

            emit EpochRewardClaimed(dlpAddress, epochNumber, unclaimedReward);
        }
    }

    function stake(uint256 dlpId) public payable override {
        _addStake(msg.sender, dlpId, msg.value);
    }

    function _deregisterDlp(address dlpAddress) internal {
        createEpochs();

        DlpInfo storage dlp = _dlpsInfo[dlpAddress];

        if (
            dlp.status != DlpStatus.Registered && dlp.status != DlpStatus.Active
        ) {
            revert InvalidDlpStatus();
        }

        uint256 index;

        EnumerableSet.AddressSet storage currentList = _activeDlpsLists[
            activeDlpsListsCount
        ];
        uint256 currentListCount = currentList.length();

        activeDlpsListsCount++;

        EnumerableSet.AddressSet storage newList = _activeDlpsLists[
            activeDlpsListsCount
        ];

        for (index = 0; index < currentListCount; index++) {
            if (currentList.at(index) != dlpAddress) {
                newList.add(currentList.at(index));
            }
        }

        _epochs[epochsCount].dlpsListId = activeDlpsListsCount;

        dlp.status = DlpStatus.Deregistered;
        dlp.lastBlockNumber = block.number;

        emit DlpDeregistered(dlpAddress);
    }

    /**
     * @notice Set the emission scores for the dlps
     *
     * @param epochNumber                   epoch number
     */
    function _setEmissionScores(uint256 epochNumber) internal {
        EnumerableSet.AddressSet storage epochDlps = _activeDlpsLists[
            _epochs[epochNumber].dlpsListId
        ];

        uint256 epochDlpsCount = epochDlps.length();

        Epoch storage epoch = _epochs[epochNumber];
        for (uint256 i = 0; i < epochDlpsCount; i++) {
            address dlpAddress = epochDlps.at(i);
            DlpInfo storage dlp = _dlpsInfo[dlpAddress];
            uint256 dlpRewardAmount = (dlp.score * epoch.reward) / 1e18;

            DlpReward storage dlpReward = epoch.dlpRewards[dlpAddress];

            dlpReward.score = dlp.score;

            //send the reward to the dlps
            if (
                dlpRewardAmount > 0 && totalDlpsRewardAmount > dlpRewardAmount
            ) {
                dlpReward.withdrawnAmount = dlpRewardAmount;
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
        StakerInfo storage _stakerInfo = _stakersInfo[stakerAddress];

        _stakerInfo.totalStaked += amount;
        _stakerInfo.stakedDlps[dlpId] += amount;

        DlpInfo storage dlp = _dlpsInfo[_dlps[dlpId]];
        dlp.stakeAmount += amount;

        emit Staked(stakerAddress, dlpId, amount);
    }

    function _unstake(
        address stakerAddress,
        uint256 dlpId,
        uint256 amount
    ) internal {
        StakerInfo storage _stakerInfo = _stakersInfo[stakerAddress];

        _stakerInfo.totalStaked -= amount;
        _stakerInfo.stakedDlps[dlpId] -= amount;

        DlpInfo storage dlp = _dlpsInfo[_dlps[dlpId]];
        dlp.stakeAmount -= amount;

        payable(stakerAddress).transfer(amount);

        emit Unstaked(stakerAddress, dlpId, amount);
    }
}
