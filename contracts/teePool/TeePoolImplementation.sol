// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/TeePoolStorageV1.sol";

contract TeePoolImplementation is
    UUPSUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    ReentrancyGuardUpgradeable,
    TeePoolStorageV1
{
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @notice Triggered when a job has been submitted
     *
     * @param jobId                             id of the job
     * @param fileId                            id of the file
     * @param bidAmount                         bid amount
     */
    event JobSubmitted(uint256 indexed jobId, uint256 indexed fileId, uint256 bidAmount);

    /**
     * @notice Triggered when a job has been cancelled
     *
     * @param jobId                             id of the job
     */
    event JobCanceled(uint256 indexed jobId);

    /**
     * @notice Triggered when a proof has been added
     *
     * @param attestator                         address of the attestator
     * @param jobId                             id of the job
     * @param fileId                            id of the file
     */
    event ProofAdded(address indexed attestator, uint256 indexed jobId, uint256 indexed fileId);

    /**
     * @notice Triggered when a tee has been added
     *
     * @param teeAddress                        address of the tee
     */
    event TeeAdded(address indexed teeAddress);

    /**
     * @notice Triggered when a tee has been removed
     *
     * @param teeAddress                        address of the tee
     */
    event TeeRemoved(address indexed teeAddress);

    /**
     * @notice Triggered when a claim has been made
     *
     * @param teeAddress                        address of the tee
     * @param amount                            amount claimed
     */
    event Claimed(address indexed teeAddress, uint256 amount);

    error TeeAlreadyAdded();
    error TeeNotActive();
    error JobCompleted();
    error InvalidJobStatus();
    error NothingToClaim();
    error InsufficientFee();
    error NoActiveTee();
    error NotJobOwner();
    error CancelDelayNotPassed();
    error TransferFailed();

    modifier onlyActiveTee() {
        if (!(_tees[msg.sender].status == TeeStatus.Active)) {
            revert TeeNotActive();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     *
     * @param ownerAddress                      address of the owner
     * @param dataRegistryAddress               address of the data registry contract
     * @param initialCancelDelay                initial cancel delay
     */
    function initialize(
        address ownerAddress,
        address dataRegistryAddress,
        uint256 initialCancelDelay
    ) external initializer {
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        dataRegistry = IDataRegistry(dataRegistryAddress);
        cancelDelay = initialCancelDelay;

        _transferOwnership(ownerAddress);
    }

    /**
     * @notice Upgrade the contract
     * This function is required by OpenZeppelin's UUPSUpgradeable
     *
     * @param newImplementation                  new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner {}

    /**
     * @notice Returns the version of the contract
     */
    function version() external pure virtual override returns (uint256) {
        return 1;
    }

    /**
     * @notice Returns the details of the job
     *
     * @param jobId                             id of the job
     * @return Job                              details of the job
     */
    function jobs(uint256 jobId) external view override returns (Job memory) {
        return _jobs[jobId];
    }

    /**
     * @notice Returns the details of the tee
     *
     * @param teeAddress                        address of the tee
     * @return TeeDetails                       details of the tee
     */
    function tees(address teeAddress) public view override returns (TeeInfo memory) {
        return
            TeeInfo({
                teeAddress: teeAddress,
                url: _tees[teeAddress].url,
                status: _tees[teeAddress].status,
                amount: _tees[teeAddress].amount,
                withdrawnAmount: _tees[teeAddress].withdrawnAmount
            });
    }

    /**
     * @notice Returns the number of tees
     */
    function teesCount() external view override returns (uint256) {
        return _teeList.length();
    }

    /**
     * @notice Returns the list of tees
     */
    function teeList() external view override returns (address[] memory) {
        return _teeList.values();
    }

    /**
     * @notice Returns the details of the tee at the given index
     *
     * @param index                             index of the tee
     * @return TeeDetails                       details of the tee
     */
    function teeListAt(uint256 index) external view override returns (TeeInfo memory) {
        return tees(_teeList.at(index));
    }

    /**
     * @notice Returns the number of active tees
     */
    function activeTeesCount() external view override returns (uint256) {
        return _activeTeeList.length();
    }

    /**
     * @notice Returns the list of active tees
     */
    function activeTeeList() external view override returns (address[] memory) {
        return _activeTeeList.values();
    }

    /**
     * @notice Returns the details of the active tee at the given index
     *
     * @param index                             index of the tee
     * @return TeeDetails                       details of the tee
     */
    function activeTeeListAt(uint256 index) external view override returns (TeeInfo memory) {
        return tees(_activeTeeList.at(index));
    }

    function isTee(address teeAddress) external view override returns (bool) {
        return _tees[teeAddress].status == TeeStatus.Active;
    }

    /**
     * @notice Returns details of the tee for the given job
     *
     * @param jobId                             id of the job
     * @return TeeDetails                       details of the tee
     */
    function jobTee(uint256 jobId) external view override returns (TeeInfo memory) {
        if (_activeTeeList.length() == 0) {
            revert NoActiveTee();
        }
        return tees(_activeTeeList.at(jobId % _activeTeeList.length()));
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
     * @notice Updates the file registry
     *
     * @param newDataRegistry                   new file registry
     */
    function updateDataRegistry(IDataRegistry newDataRegistry) external override onlyOwner {
        dataRegistry = newDataRegistry;
    }

    /**
     * @notice Updates the tee fee
     *
     * @param newTeeFee                         new fee
     */
    function updateTeeFee(uint256 newTeeFee) external override onlyOwner {
        teeFee = newTeeFee;
    }

    /**
     * @notice Updates the cancel delay
     *
     * @param newCancelDelay                    new cancel delay
     */
    function updateCancelDelay(uint256 newCancelDelay) external override onlyOwner {
        cancelDelay = newCancelDelay;
    }

    /**
     * @notice Adds a tee to the pool
     *
     * @param teeAddress                        address of the tee
     * @param url                               url of the tee
     */
    function addTee(address teeAddress, string memory url) external override onlyOwner {
        if (_activeTeeList.contains(teeAddress)) {
            revert TeeAlreadyAdded();
        }
        _teeList.add(teeAddress);
        _activeTeeList.add(teeAddress);
        _tees[teeAddress].status = TeeStatus.Active;
        _tees[teeAddress].url = url;

        emit TeeAdded(teeAddress);
    }

    /**
     * @notice Removes a tee from the pool
     *
     * @param teeAddress                        address of the tee
     */
    function removeTee(address teeAddress) external override onlyOwner {
        if (!_activeTeeList.contains(teeAddress)) {
            revert TeeNotActive();
        }

        _tees[teeAddress].status = TeeStatus.Removed;
        _activeTeeList.remove(teeAddress);

        emit TeeRemoved(teeAddress);
    }

    /**
     * @notice Adds a contribution proof request
     *
     * @param fileId                            id of the file
     */
    function requestContributionProof(uint256 fileId) public payable override {
        if (msg.value < teeFee) {
            revert InsufficientFee();
        }

        jobsCount++;
        _jobs[jobsCount].fileId = fileId;
        _jobs[jobsCount].bidAmount = msg.value;
        _jobs[jobsCount].addedTimestamp = block.timestamp;
        _jobs[jobsCount].ownerAddress = msg.sender;
        _jobs[jobsCount].status = JobStatus.Submitted;

        emit JobSubmitted(jobsCount, fileId, msg.value);
    }

    /**
     * @notice Submits a contribution proof request
     *
     * @param fileId                            id of the file
     */
    function submitJob(uint256 fileId) external payable override {
        requestContributionProof(fileId);
    }

    /**
     * @notice Cancels a contribution proof request
     *
     * @param jobId                            id of the job
     */
    function cancelJob(uint256 jobId) external override nonReentrant {
        if (_jobs[jobId].ownerAddress != msg.sender) {
            revert NotJobOwner();
        }

        if (_jobs[jobId].status != JobStatus.Submitted) {
            revert InvalidJobStatus();
        }

        if (_jobs[jobId].addedTimestamp + cancelDelay > block.timestamp) {
            revert CancelDelayNotPassed();
        }

        _jobs[jobsCount].status = JobStatus.Canceled;

        (bool success, ) = payable(msg.sender).call{value: _jobs[jobId].bidAmount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit JobCanceled(jobId);
    }

    /**
     * @notice Adds a proof to the file
     *
     * @param jobId                             id of the job
     * @param proof                             proof for the file
     */
    function addProof(uint256 jobId, IDataRegistry.Proof memory proof) external payable override onlyActiveTee {
        Job storage job = _jobs[jobId];

        if (job.status != JobStatus.Submitted) {
            revert JobCompleted();
        }

        dataRegistry.addProof(job.fileId, proof);

        _tees[msg.sender].amount += job.bidAmount;
        job.status = JobStatus.Completed;

        emit ProofAdded(msg.sender, jobId, job.fileId);
    }

    /**
     * @notice method used by tees for claiming their rewards
     */
    function claim() external nonReentrant {
        uint256 amount = _tees[msg.sender].amount - _tees[msg.sender].withdrawnAmount;

        if (amount == 0) {
            revert NothingToClaim();
        }

        _tees[msg.sender].withdrawnAmount = _tees[msg.sender].amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit Claimed(msg.sender, amount);
    }
}
