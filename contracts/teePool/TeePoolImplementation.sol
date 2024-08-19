// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/TeePoolStorageV1.sol";

import "hardhat/console.sol";

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
    event ProofAdded(address indexed atestator, uint256 indexed jobId, uint256 indexed fileId);

    event TeeAdded(address indexed teeAddress);
    event TeeRemoved(address indexed teeAddress);
    event Claimed(address indexed teeAddress, uint256 amount);

    error TeeAlreadyAdded();
    error TeeNotActive();
    error JobCompleted();
    error NothingToClaim();
    error InsufficientFee();
    error NoActiveTee();

    modifier onlyActiveTee() {
        if (!(_tees[msg.sender].status == TeeStatus.Active)) {
            revert TeeNotActive();
        }
        _;
    }

    /**
     * @notice Initialize the contract
     *
     * @param ownerAddress                      address of the owner
     */
    function initialize(address ownerAddress, address dataRegistryAddress) external initializer {
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        dataRegistry = IDataRegistry(dataRegistryAddress);

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
    function tees(address teeAddress) public view override returns (TeeDetails memory) {
        return
            TeeDetails({
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
    function teeListAt(uint256 index) external view override returns (TeeDetails memory) {
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
    function activeTeeListAt(uint256 index) external view override returns (TeeDetails memory) {
        return tees(_activeTeeList.at(index));
    }

    /**
     * @notice Returns details of the tee for the given job
     *
     * @param jobId                             id of the job
     * @return TeeDetails                       details of the tee
     */
    function jobTee(uint256 jobId) external view override returns (TeeDetails memory) {
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
     * @notice Request a contribution proof
     *
     * @param fileId                            id of the file
     */
    function requestContributionProof(uint256 fileId) external payable override {
        if (msg.value < teeFee) {
            revert InsufficientFee();
        }

        jobsCount++;
        _jobs[jobsCount].fileId = fileId;
        _jobs[jobsCount].bidAmount = msg.value;

        emit JobSubmitted(jobsCount, fileId, msg.value);
    }

    /**
     * @notice Adds a proof to the file
     *
     * @param jobId                             id of the job
     * @param proof                             proof for the file
     */
    function addProof(uint256 jobId, IDataRegistry.Proof memory proof) external payable override onlyActiveTee {
        Job storage job = _jobs[jobId];

        if (job.status != JobStatus.None) {
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

        payable(msg.sender).transfer(amount);

        emit Claimed(msg.sender, amount);
    }
}
