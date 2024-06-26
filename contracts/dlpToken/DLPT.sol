// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract HDOG is ERC20, ERC20Permit, ERC20Votes, Ownable2Step {
    using EnumerableSet for EnumerableSet.AddressSet;

    address public admin;
    bool public mintBlocked;
    EnumerableSet.AddressSet private _blockList;

    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event MintBlocked();

    /**
     * @dev Emitted when the admin is updated.
     *
     * @param oldAdmin    the old admin address
     * @param newAdmin    the new admin address
     */
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    /**
     * @dev Emitted when and address is added to the blockList
     *
     * @param blockedAddress    the address to be blocked
     */
    event AddressBlocked(address indexed blockedAddress);

    /**
     * @dev Emitted when and address is removed from the blockList
     *
     * @param unblockedAddress    the address to be unblocked
     */
    event AddressUnblocked(address indexed unblockedAddress);

    /**
     * @dev The operation failed because the mint is blocked.
     */
    error EnforceMintBlocked();

    /**
     * @dev The caller account is not authorized to perform an admin operation.
     */
    error UnauthorizedAdminAction(address account);

    /**
     * @dev The caller account is blocked
     */
    error UnauthorizedUserAction(address account);

    modifier whenMintIsAllowed() {
        if (mintBlocked) {
            revert EnforceMintBlocked();
        }
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) {
            revert UnauthorizedAdminAction(msg.sender);
        }
        _;
    }

    modifier whenNotBlocked(address from) {
        if (_blockList.contains(from)) {
            revert UnauthorizedUserAction(msg.sender);
        }
        _;
    }

    constructor(address ownerAddress) ERC20("HDOG Token", "HDOG") ERC20Permit("HDOG Token") Ownable(ownerAddress) {}

    // Overrides IERC6372 functions to make the token & governor timestamp-based
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    function blockListLength() external view returns(uint256) {
        return _blockList.length();
    }

    function blockListAt(uint256 _index) external view returns(address) {
        return _blockList.at(_index);
    }

    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) whenNotBlocked(from) {
        super._update(from, to, amount);
    }

    function nonces(address owner) public view virtual override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    function mint(address to, uint256 amount) external virtual onlyOwner whenMintIsAllowed {
        _mint(to, amount);
    }

    /**
     * @dev Changes admin address
     */
    function changeAdmin(address newAdmin) external virtual onlyOwner {
        address oldAdmin = admin;
        admin = newAdmin;
        emit AdminChanged(oldAdmin, newAdmin);
    }

    /**
     * @dev Blocks feature mints
     *
     * Once this method is invoked there is no way to mint more tokens
     */
    function blockMint() external virtual onlyOwner whenMintIsAllowed {
        mintBlocked = true;
        emit MintBlocked();
    }

    /**
     * @dev Adds an address to the blockList. This address is not able to transfer any more
     */
    function blockAddress(address addressToBeBlocked) external virtual onlyAdmin {
        _blockList.add(addressToBeBlocked);

        emit AddressBlocked(addressToBeBlocked);
    }

    /**
     * @dev Removes an address from the blockList
     */
    function unblockAddress(address addressToBeUnblocked) external virtual onlyAdmin {
        _blockList.remove(addressToBeUnblocked);

        emit AddressUnblocked(addressToBeUnblocked);
    }
}
