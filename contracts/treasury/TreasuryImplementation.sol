// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/TreasuryStorageV1.sol";

contract TreasuryImplementation is
    UUPSUpgradeable,
    PausableUpgradeable,
    Ownable2StepUpgradeable,
    ReentrancyGuardUpgradeable,
    TreasuryStorageV1
{
    using SafeERC20 for IERC20;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Used to initialize a new Treasury contract
     *
     * @param ownerAddress            Address of the owner
     */
    function initialize(address ownerAddress) external initializer {
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

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
     * return the version of the contract
     */
    function version() external pure virtual override returns (uint256) {
        return 1;
    }

    /**
     * @notice Fallback function to receive VANA
     */
    receive() external payable {}

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
}
