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
    event ProofAdded(address indexed atestator, uint256 indexed jobId, uint256 indexed fileId);

    event TeeAdded(address indexed teeAddress);
    event TeeRemoved(address indexed teeAddress);
    event Claimed(address indexed teeAddress, uint256 amount);

    error TeeAlreadyAdded();
    error TeeNotActive();
    error JobCompleted();
    error NothingToClaim();

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
    function initialize(address ownerAddress, address fileRegistryAddress) external initializer {
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        fileRegistry = IFileRegistry(fileRegistryAddress);

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

    function jobs(uint256 jobId) external view override returns (Job memory) {
        return _jobs[jobId];
        //        return JobResponse({
        //            fileId: _jobs[jobId].fileId,
        //            bidAmount: _jobs[jobId].bidAmount,
        //            teeAddress: _jobs[jobId].teeAddress,
        //            proofsCount: 0
        //        });
    }

    function tees(address teeAddress) public view override returns (TeeInfo memory) {
        return
            TeeInfo({
                teeAddress: teeAddress,
                status: _tees[teeAddress].status,
                amount: _tees[teeAddress].amount,
                withdrawnAmount: _tees[teeAddress].withdrawnAmount
            });
    }

    function teesCount() external view override returns (uint256) {
        return _teeList.length();
    }

    function teeList() external view override returns (address[] memory) {
        return _teeList.values();
    }

    function teeListAt(uint256 index) external view override returns (TeeInfo memory) {
        return tees(_teeList.at(index));
    }

    function activeTeesCount() external view override returns (uint256) {
        return _activeTeeList.length();
    }

    function activeTeeList() external view override returns (address[] memory) {
        return _activeTeeList.values();
    }

    function activeTeeListAt(uint256 index) external view override returns (TeeInfo memory) {
        return tees(_activeTeeList.at(index));
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

    function updateFileRegistry(IFileRegistry newFileRegistry) external override onlyOwner {
        fileRegistry = newFileRegistry;
    }

    function addTee(address teeAddress) external override onlyOwner {
        if (_activeTeeList.contains(teeAddress)) {
            revert TeeAlreadyAdded();
        }
        _teeList.add(teeAddress);
        _activeTeeList.add(teeAddress);
        _tees[teeAddress].status = TeeStatus.Active;

        emit TeeAdded(teeAddress);
    }

    function removeTee(address teeAddress) external override onlyOwner {
        if (!_activeTeeList.contains(teeAddress)) {
            revert TeeNotActive();
        }

        _tees[teeAddress].status = TeeStatus.Removed;
        _activeTeeList.remove(teeAddress);

        emit TeeRemoved(teeAddress);
    }

    function submitValidationJob(uint256 fileId) external payable override {
        jobsCount++;
        _jobs[jobsCount].fileId = fileId;
        _jobs[jobsCount].bidAmount = msg.value;

        emit JobSubmitted(jobsCount, fileId, msg.value);
    }

    function submitProof(uint256 jobId, IFileRegistry.Proof memory proof) external payable override onlyActiveTee {
        Job storage job = _jobs[jobId];

        if (job.status != JobStatus.None) {
            revert JobCompleted();
        }

        fileRegistry.addProofOrigin(job.fileId, proof);

        _tees[msg.sender].amount += job.bidAmount;
        job.status = JobStatus.Completed;

        emit ProofAdded(msg.sender, jobId, job.fileId);
    }

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
