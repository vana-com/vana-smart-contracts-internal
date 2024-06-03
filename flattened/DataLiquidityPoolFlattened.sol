// Sources flattened with hardhat v2.22.2 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (proxy/utils/Initializable.sol)

pragma solidity ^0.8.20;

/**
 * @dev This is a base contract to aid in writing upgradeable contracts, or any kind of contract that will be deployed
 * behind a proxy. Since proxied contracts do not make use of a constructor, it's common to move constructor logic to an
 * external initializer function, usually called `initialize`. It then becomes necessary to protect this initializer
 * function so it can only be called once. The {initializer} modifier provided by this contract will have this effect.
 *
 * The initialization functions use a version number. Once a version number is used, it is consumed and cannot be
 * reused. This mechanism prevents re-execution of each "step" but allows the creation of new initialization steps in
 * case an upgrade adds a module that needs to be initialized.
 *
 * For example:
 *
 * [.hljs-theme-light.nopadding]
 * ```solidity
 * contract MyToken is ERC20Upgradeable {
 *     function initialize() initializer public {
 *         __ERC20_init("MyToken", "MTK");
 *     }
 * }
 *
 * contract MyTokenV2 is MyToken, ERC20PermitUpgradeable {
 *     function initializeV2() reinitializer(2) public {
 *         __ERC20Permit_init("MyToken");
 *     }
 * }
 * ```
 *
 * TIP: To avoid leaving the proxy in an uninitialized state, the initializer function should be called as early as
 * possible by providing the encoded function call as the `_data` argument to {ERC1967Proxy-constructor}.
 *
 * CAUTION: When used with inheritance, manual care must be taken to not invoke a parent initializer twice, or to ensure
 * that all initializers are idempotent. This is not verified automatically as constructors are by Solidity.
 *
 * [CAUTION]
 * ====
 * Avoid leaving a contract uninitialized.
 *
 * An uninitialized contract can be taken over by an attacker. This applies to both a proxy and its implementation
 * contract, which may impact the proxy. To prevent the implementation contract from being used, you should invoke
 * the {_disableInitializers} function in the constructor to automatically lock it when it is deployed:
 *
 * [.hljs-theme-light.nopadding]
 * ```
 * /// @custom:oz-upgrades-unsafe-allow constructor
 * constructor() {
 *     _disableInitializers();
 * }
 * ```
 * ====
 */
abstract contract Initializable {
    /**
     * @dev Storage of the initializable contract.
     *
     * It's implemented on a custom ERC-7201 namespace to reduce the risk of storage collisions
     * when using with upgradeable contracts.
     *
     * @custom:storage-location erc7201:openzeppelin.storage.Initializable
     */
    struct InitializableStorage {
        /**
         * @dev Indicates that the contract has been initialized.
         */
        uint64 _initialized;
        /**
         * @dev Indicates that the contract is in the process of being initialized.
         */
        bool _initializing;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Initializable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant INITIALIZABLE_STORAGE = 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;

    /**
     * @dev The contract is already initialized.
     */
    error InvalidInitialization();

    /**
     * @dev The contract is not initializing.
     */
    error NotInitializing();

    /**
     * @dev Triggered when the contract has been initialized or reinitialized.
     */
    event Initialized(uint64 version);

    /**
     * @dev A modifier that defines a protected initializer function that can be invoked at most once. In its scope,
     * `onlyInitializing` functions can be used to initialize parent contracts.
     *
     * Similar to `reinitializer(1)`, except that in the context of a constructor an `initializer` may be invoked any
     * number of times. This behavior in the constructor can be useful during testing and is not expected to be used in
     * production.
     *
     * Emits an {Initialized} event.
     */
    modifier initializer() {
        // solhint-disable-next-line var-name-mixedcase
        InitializableStorage storage $ = _getInitializableStorage();

        // Cache values to avoid duplicated sloads
        bool isTopLevelCall = !$._initializing;
        uint64 initialized = $._initialized;

        // Allowed calls:
        // - initialSetup: the contract is not in the initializing state and no previous version was
        //                 initialized
        // - construction: the contract is initialized at version 1 (no reininitialization) and the
        //                 current contract is just being deployed
        bool initialSetup = initialized == 0 && isTopLevelCall;
        bool construction = initialized == 1 && address(this).code.length == 0;

        if (!initialSetup && !construction) {
            revert InvalidInitialization();
        }
        $._initialized = 1;
        if (isTopLevelCall) {
            $._initializing = true;
        }
        _;
        if (isTopLevelCall) {
            $._initializing = false;
            emit Initialized(1);
        }
    }

    /**
     * @dev A modifier that defines a protected reinitializer function that can be invoked at most once, and only if the
     * contract hasn't been initialized to a greater version before. In its scope, `onlyInitializing` functions can be
     * used to initialize parent contracts.
     *
     * A reinitializer may be used after the original initialization step. This is essential to configure modules that
     * are added through upgrades and that require initialization.
     *
     * When `version` is 1, this modifier is similar to `initializer`, except that functions marked with `reinitializer`
     * cannot be nested. If one is invoked in the context of another, execution will revert.
     *
     * Note that versions can jump in increments greater than 1; this implies that if multiple reinitializers coexist in
     * a contract, executing them in the right order is up to the developer or operator.
     *
     * WARNING: Setting the version to 2**64 - 1 will prevent any future reinitialization.
     *
     * Emits an {Initialized} event.
     */
    modifier reinitializer(uint64 version) {
        // solhint-disable-next-line var-name-mixedcase
        InitializableStorage storage $ = _getInitializableStorage();

        if ($._initializing || $._initialized >= version) {
            revert InvalidInitialization();
        }
        $._initialized = version;
        $._initializing = true;
        _;
        $._initializing = false;
        emit Initialized(version);
    }

    /**
     * @dev Modifier to protect an initialization function so that it can only be invoked by functions with the
     * {initializer} and {reinitializer} modifiers, directly or indirectly.
     */
    modifier onlyInitializing() {
        _checkInitializing();
        _;
    }

    /**
     * @dev Reverts if the contract is not in an initializing state. See {onlyInitializing}.
     */
    function _checkInitializing() internal view virtual {
        if (!_isInitializing()) {
            revert NotInitializing();
        }
    }

    /**
     * @dev Locks the contract, preventing any future reinitialization. This cannot be part of an initializer call.
     * Calling this in the constructor of a contract will prevent that contract from being initialized or reinitialized
     * to any version. It is recommended to use this to lock implementation contracts that are designed to be called
     * through proxies.
     *
     * Emits an {Initialized} event the first time it is successfully executed.
     */
    function _disableInitializers() internal virtual {
        // solhint-disable-next-line var-name-mixedcase
        InitializableStorage storage $ = _getInitializableStorage();

        if ($._initializing) {
            revert InvalidInitialization();
        }
        if ($._initialized != type(uint64).max) {
            $._initialized = type(uint64).max;
            emit Initialized(type(uint64).max);
        }
    }

    /**
     * @dev Returns the highest version that has been initialized. See {reinitializer}.
     */
    function _getInitializedVersion() internal view returns (uint64) {
        return _getInitializableStorage()._initialized;
    }

    /**
     * @dev Returns `true` if the contract is currently initializing. See {onlyInitializing}.
     */
    function _isInitializing() internal view returns (bool) {
        return _getInitializableStorage()._initializing;
    }

    /**
     * @dev Returns a pointer to the storage namespace.
     */
    // solhint-disable-next-line var-name-mixedcase
    function _getInitializableStorage() private pure returns (InitializableStorage storage $) {
        assembly {
            $.slot := INITIALIZABLE_STORAGE
        }
    }
}


// File @openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract ContextUpgradeable is Initializable {
    function __Context_init() internal onlyInitializing {
    }

    function __Context_init_unchained() internal onlyInitializing {
    }
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/utils/introspection/IERC165.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/introspection/IERC165.sol)

pragma solidity ^0.8.20;

/**
 * @dev Interface of the ERC165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[EIP].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}


// File @openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/introspection/ERC165.sol)

pragma solidity ^0.8.20;


/**
 * @dev Implementation of the {IERC165} interface.
 *
 * Contracts that want to implement ERC165 should inherit from this contract and override {supportsInterface} to check
 * for the additional interface id that will be supported. For example:
 *
 * ```solidity
 * function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
 *     return interfaceId == type(MyInterface).interfaceId || super.supportsInterface(interfaceId);
 * }
 * ```
 */
abstract contract ERC165Upgradeable is Initializable, IERC165 {
    function __ERC165_init() internal onlyInitializing {
    }

    function __ERC165_init_unchained() internal onlyInitializing {
    }
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}


// File @openzeppelin/contracts/access/IAccessControl.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/IAccessControl.sol)

pragma solidity ^0.8.20;

/**
 * @dev External interface of AccessControl declared to support ERC165 detection.
 */
interface IAccessControl {
    /**
     * @dev The `account` is missing a role.
     */
    error AccessControlUnauthorizedAccount(address account, bytes32 neededRole);

    /**
     * @dev The caller of a function is not the expected one.
     *
     * NOTE: Don't confuse with {AccessControlUnauthorizedAccount}.
     */
    error AccessControlBadConfirmation();

    /**
     * @dev Emitted when `newAdminRole` is set as ``role``'s admin role, replacing `previousAdminRole`
     *
     * `DEFAULT_ADMIN_ROLE` is the starting admin for all roles, despite
     * {RoleAdminChanged} not being emitted signaling this.
     */
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);

    /**
     * @dev Emitted when `account` is granted `role`.
     *
     * `sender` is the account that originated the contract call, an admin role
     * bearer except when using {AccessControl-_setupRole}.
     */
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Emitted when `account` is revoked `role`.
     *
     * `sender` is the account that originated the contract call:
     *   - if using `revokeRole`, it is the admin role bearer
     *   - if using `renounceRole`, it is the role bearer (i.e. `account`)
     */
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) external view returns (bool);

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {AccessControl-_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) external view returns (bytes32);

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function grantRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function revokeRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been granted `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `callerConfirmation`.
     */
    function renounceRole(bytes32 role, address callerConfirmation) external;
}


// File @openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/AccessControl.sol)

pragma solidity ^0.8.20;




/**
 * @dev Contract module that allows children to implement role-based access
 * control mechanisms. This is a lightweight version that doesn't allow enumerating role
 * members except through off-chain means by accessing the contract event logs. Some
 * applications may benefit from on-chain enumerability, for those cases see
 * {AccessControlEnumerable}.
 *
 * Roles are referred to by their `bytes32` identifier. These should be exposed
 * in the external API and be unique. The best way to achieve this is by
 * using `public constant` hash digests:
 *
 * ```solidity
 * bytes32 public constant MY_ROLE = keccak256("MY_ROLE");
 * ```
 *
 * Roles can be used to represent a set of permissions. To restrict access to a
 * function call, use {hasRole}:
 *
 * ```solidity
 * function foo() public {
 *     require(hasRole(MY_ROLE, msg.sender));
 *     ...
 * }
 * ```
 *
 * Roles can be granted and revoked dynamically via the {grantRole} and
 * {revokeRole} functions. Each role has an associated admin role, and only
 * accounts that have a role's admin role can call {grantRole} and {revokeRole}.
 *
 * By default, the admin role for all roles is `DEFAULT_ADMIN_ROLE`, which means
 * that only accounts with this role will be able to grant or revoke other
 * roles. More complex role relationships can be created by using
 * {_setRoleAdmin}.
 *
 * WARNING: The `DEFAULT_ADMIN_ROLE` is also its own admin: it has permission to
 * grant and revoke this role. Extra precautions should be taken to secure
 * accounts that have been granted it. We recommend using {AccessControlDefaultAdminRules}
 * to enforce additional security measures for this role.
 */
abstract contract AccessControlUpgradeable is Initializable, ContextUpgradeable, IAccessControl, ERC165Upgradeable {
    struct RoleData {
        mapping(address account => bool) hasRole;
        bytes32 adminRole;
    }

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;


    /// @custom:storage-location erc7201:openzeppelin.storage.AccessControl
    struct AccessControlStorage {
        mapping(bytes32 role => RoleData) _roles;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.AccessControl")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant AccessControlStorageLocation = 0x02dd7bc7dec4dceedda775e58dd541e08a116c6c53815c0bd028192f7b626800;

    function _getAccessControlStorage() private pure returns (AccessControlStorage storage $) {
        assembly {
            $.slot := AccessControlStorageLocation
        }
    }

    /**
     * @dev Modifier that checks that an account has a specific role. Reverts
     * with an {AccessControlUnauthorizedAccount} error including the required role.
     */
    modifier onlyRole(bytes32 role) {
        _checkRole(role);
        _;
    }

    function __AccessControl_init() internal onlyInitializing {
    }

    function __AccessControl_init_unchained() internal onlyInitializing {
    }
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAccessControl).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) public view virtual returns (bool) {
        AccessControlStorage storage $ = _getAccessControlStorage();
        return $._roles[role].hasRole[account];
    }

    /**
     * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `_msgSender()`
     * is missing `role`. Overriding this function changes the behavior of the {onlyRole} modifier.
     */
    function _checkRole(bytes32 role) internal view virtual {
        _checkRole(role, _msgSender());
    }

    /**
     * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `account`
     * is missing `role`.
     */
    function _checkRole(bytes32 role, address account) internal view virtual {
        if (!hasRole(role, account)) {
            revert AccessControlUnauthorizedAccount(account, role);
        }
    }

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) public view virtual returns (bytes32) {
        AccessControlStorage storage $ = _getAccessControlStorage();
        return $._roles[role].adminRole;
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleGranted} event.
     */
    function grantRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleRevoked} event.
     */
    function revokeRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been revoked `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `callerConfirmation`.
     *
     * May emit a {RoleRevoked} event.
     */
    function renounceRole(bytes32 role, address callerConfirmation) public virtual {
        if (callerConfirmation != _msgSender()) {
            revert AccessControlBadConfirmation();
        }

        _revokeRole(role, callerConfirmation);
    }

    /**
     * @dev Sets `adminRole` as ``role``'s admin role.
     *
     * Emits a {RoleAdminChanged} event.
     */
    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal virtual {
        AccessControlStorage storage $ = _getAccessControlStorage();
        bytes32 previousAdminRole = getRoleAdmin(role);
        $._roles[role].adminRole = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }

    /**
     * @dev Attempts to grant `role` to `account` and returns a boolean indicating if `role` was granted.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleGranted} event.
     */
    function _grantRole(bytes32 role, address account) internal virtual returns (bool) {
        AccessControlStorage storage $ = _getAccessControlStorage();
        if (!hasRole(role, account)) {
            $._roles[role].hasRole[account] = true;
            emit RoleGranted(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Attempts to revoke `role` to `account` and returns a boolean indicating if `role` was revoked.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleRevoked} event.
     */
    function _revokeRole(bytes32 role, address account) internal virtual returns (bool) {
        AccessControlStorage storage $ = _getAccessControlStorage();
        if (hasRole(role, account)) {
            $._roles[role].hasRole[account] = false;
            emit RoleRevoked(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }
}


// File @openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;


/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract OwnableUpgradeable is Initializable, ContextUpgradeable {
    /// @custom:storage-location erc7201:openzeppelin.storage.Ownable
    struct OwnableStorage {
        address _owner;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Ownable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant OwnableStorageLocation = 0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300;

    function _getOwnableStorage() private pure returns (OwnableStorage storage $) {
        assembly {
            $.slot := OwnableStorageLocation
        }
    }

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    function __Ownable_init(address initialOwner) internal onlyInitializing {
        __Ownable_init_unchained(initialOwner);
    }

    function __Ownable_init_unchained(address initialOwner) internal onlyInitializing {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        OwnableStorage storage $ = _getOwnableStorage();
        return $._owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        OwnableStorage storage $ = _getOwnableStorage();
        address oldOwner = $._owner;
        $._owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/interfaces/draft-IERC1822.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (interfaces/draft-IERC1822.sol)

pragma solidity ^0.8.20;

/**
 * @dev ERC1822: Universal Upgradeable Proxy Standard (UUPS) documents a method for upgradeability through a simplified
 * proxy whose upgrades are fully controlled by the current implementation.
 */
interface IERC1822Proxiable {
    /**
     * @dev Returns the storage slot that the proxiable contract assumes is being used to store the implementation
     * address.
     *
     * IMPORTANT: A proxy pointing at a proxiable contract should not be considered proxiable itself, because this risks
     * bricking a proxy that upgrades to it, by delegating to itself until out of gas. Thus it is critical that this
     * function revert if invoked through a proxy.
     */
    function proxiableUUID() external view returns (bytes32);
}


// File @openzeppelin/contracts/proxy/beacon/IBeacon.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (proxy/beacon/IBeacon.sol)

pragma solidity ^0.8.20;

/**
 * @dev This is the interface that {BeaconProxy} expects of its beacon.
 */
interface IBeacon {
    /**
     * @dev Must return an address that can be used as a delegate call target.
     *
     * {UpgradeableBeacon} will check that this address is a contract.
     */
    function implementation() external view returns (address);
}


// File @openzeppelin/contracts/utils/Address.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/Address.sol)

pragma solidity ^0.8.20;

/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev The ETH balance of the account is not enough to perform the operation.
     */
    error AddressInsufficientBalance(address account);

    /**
     * @dev There's no code at `target` (it is not a contract).
     */
    error AddressEmptyCode(address target);

    /**
     * @dev A call to an address target failed. The target may have reverted.
     */
    error FailedInnerCall();

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.8.20/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        if (address(this).balance < amount) {
            revert AddressInsufficientBalance(address(this));
        }

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert FailedInnerCall();
        }
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason or custom error, it is bubbled
     * up by this function (like regular Solidity function calls). However, if
     * the call reverted with no returned reason, this function reverts with a
     * {FailedInnerCall} error.
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) {
            revert AddressInsufficientBalance(address(this));
        }
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    /**
     * @dev Tool to verify that a low level call to smart-contract was successful, and reverts if the target
     * was not a contract or bubbling up the revert reason (falling back to {FailedInnerCall}) in case of an
     * unsuccessful call.
     */
    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata
    ) internal view returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            // only check if target is a contract if the call was successful and the return data is empty
            // otherwise we already know that it was a contract
            if (returndata.length == 0 && target.code.length == 0) {
                revert AddressEmptyCode(target);
            }
            return returndata;
        }
    }

    /**
     * @dev Tool to verify that a low level call was successful, and reverts if it wasn't, either by bubbling the
     * revert reason or with a default {FailedInnerCall} error.
     */
    function verifyCallResult(bool success, bytes memory returndata) internal pure returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            return returndata;
        }
    }

    /**
     * @dev Reverts with returndata if present. Otherwise reverts with {FailedInnerCall}.
     */
    function _revert(bytes memory returndata) private pure {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
            // The easiest way to bubble the revert reason is using memory via assembly
            /// @solidity memory-safe-assembly
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert FailedInnerCall();
        }
    }
}


// File @openzeppelin/contracts/utils/StorageSlot.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

pragma solidity ^0.8.20;

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := store.slot
        }
    }
}


// File @openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (proxy/ERC1967/ERC1967Utils.sol)

pragma solidity ^0.8.20;



/**
 * @dev This abstract contract provides getters and event emitting update functions for
 * https://eips.ethereum.org/EIPS/eip-1967[EIP1967] slots.
 */
library ERC1967Utils {
    // We re-declare ERC-1967 events here because they can't be used directly from IERC1967.
    // This will be fixed in Solidity 0.8.21. At that point we should remove these events.
    /**
     * @dev Emitted when the implementation is upgraded.
     */
    event Upgraded(address indexed implementation);

    /**
     * @dev Emitted when the admin account has changed.
     */
    event AdminChanged(address previousAdmin, address newAdmin);

    /**
     * @dev Emitted when the beacon is changed.
     */
    event BeaconUpgraded(address indexed beacon);

    /**
     * @dev Storage slot with the address of the current implementation.
     * This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1.
     */
    // solhint-disable-next-line private-vars-leading-underscore
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    /**
     * @dev The `implementation` of the proxy is invalid.
     */
    error ERC1967InvalidImplementation(address implementation);

    /**
     * @dev The `admin` of the proxy is invalid.
     */
    error ERC1967InvalidAdmin(address admin);

    /**
     * @dev The `beacon` of the proxy is invalid.
     */
    error ERC1967InvalidBeacon(address beacon);

    /**
     * @dev An upgrade function sees `msg.value > 0` that may be lost.
     */
    error ERC1967NonPayable();

    /**
     * @dev Returns the current implementation address.
     */
    function getImplementation() internal view returns (address) {
        return StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value;
    }

    /**
     * @dev Stores a new address in the EIP1967 implementation slot.
     */
    function _setImplementation(address newImplementation) private {
        if (newImplementation.code.length == 0) {
            revert ERC1967InvalidImplementation(newImplementation);
        }
        StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value = newImplementation;
    }

    /**
     * @dev Performs implementation upgrade with additional setup call if data is nonempty.
     * This function is payable only if the setup call is performed, otherwise `msg.value` is rejected
     * to avoid stuck value in the contract.
     *
     * Emits an {IERC1967-Upgraded} event.
     */
    function upgradeToAndCall(address newImplementation, bytes memory data) internal {
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);

        if (data.length > 0) {
            Address.functionDelegateCall(newImplementation, data);
        } else {
            _checkNonPayable();
        }
    }

    /**
     * @dev Storage slot with the admin of the contract.
     * This is the keccak-256 hash of "eip1967.proxy.admin" subtracted by 1.
     */
    // solhint-disable-next-line private-vars-leading-underscore
    bytes32 internal constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    /**
     * @dev Returns the current admin.
     *
     * TIP: To get this value clients can read directly from the storage slot shown below (specified by EIP1967) using
     * the https://eth.wiki/json-rpc/API#eth_getstorageat[`eth_getStorageAt`] RPC call.
     * `0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`
     */
    function getAdmin() internal view returns (address) {
        return StorageSlot.getAddressSlot(ADMIN_SLOT).value;
    }

    /**
     * @dev Stores a new address in the EIP1967 admin slot.
     */
    function _setAdmin(address newAdmin) private {
        if (newAdmin == address(0)) {
            revert ERC1967InvalidAdmin(address(0));
        }
        StorageSlot.getAddressSlot(ADMIN_SLOT).value = newAdmin;
    }

    /**
     * @dev Changes the admin of the proxy.
     *
     * Emits an {IERC1967-AdminChanged} event.
     */
    function changeAdmin(address newAdmin) internal {
        emit AdminChanged(getAdmin(), newAdmin);
        _setAdmin(newAdmin);
    }

    /**
     * @dev The storage slot of the UpgradeableBeacon contract which defines the implementation for this proxy.
     * This is the keccak-256 hash of "eip1967.proxy.beacon" subtracted by 1.
     */
    // solhint-disable-next-line private-vars-leading-underscore
    bytes32 internal constant BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    /**
     * @dev Returns the current beacon.
     */
    function getBeacon() internal view returns (address) {
        return StorageSlot.getAddressSlot(BEACON_SLOT).value;
    }

    /**
     * @dev Stores a new beacon in the EIP1967 beacon slot.
     */
    function _setBeacon(address newBeacon) private {
        if (newBeacon.code.length == 0) {
            revert ERC1967InvalidBeacon(newBeacon);
        }

        StorageSlot.getAddressSlot(BEACON_SLOT).value = newBeacon;

        address beaconImplementation = IBeacon(newBeacon).implementation();
        if (beaconImplementation.code.length == 0) {
            revert ERC1967InvalidImplementation(beaconImplementation);
        }
    }

    /**
     * @dev Change the beacon and trigger a setup call if data is nonempty.
     * This function is payable only if the setup call is performed, otherwise `msg.value` is rejected
     * to avoid stuck value in the contract.
     *
     * Emits an {IERC1967-BeaconUpgraded} event.
     *
     * CAUTION: Invoking this function has no effect on an instance of {BeaconProxy} since v5, since
     * it uses an immutable beacon without looking at the value of the ERC-1967 beacon slot for
     * efficiency.
     */
    function upgradeBeaconToAndCall(address newBeacon, bytes memory data) internal {
        _setBeacon(newBeacon);
        emit BeaconUpgraded(newBeacon);

        if (data.length > 0) {
            Address.functionDelegateCall(IBeacon(newBeacon).implementation(), data);
        } else {
            _checkNonPayable();
        }
    }

    /**
     * @dev Reverts if `msg.value` is not zero. It can be used to avoid `msg.value` stuck in the contract
     * if an upgrade doesn't perform an initialization call.
     */
    function _checkNonPayable() private {
        if (msg.value > 0) {
            revert ERC1967NonPayable();
        }
    }
}


// File @openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (proxy/utils/UUPSUpgradeable.sol)

pragma solidity ^0.8.20;



/**
 * @dev An upgradeability mechanism designed for UUPS proxies. The functions included here can perform an upgrade of an
 * {ERC1967Proxy}, when this contract is set as the implementation behind such a proxy.
 *
 * A security mechanism ensures that an upgrade does not turn off upgradeability accidentally, although this risk is
 * reinstated if the upgrade retains upgradeability but removes the security mechanism, e.g. by replacing
 * `UUPSUpgradeable` with a custom implementation of upgrades.
 *
 * The {_authorizeUpgrade} function must be overridden to include access restriction to the upgrade mechanism.
 */
abstract contract UUPSUpgradeable is Initializable, IERC1822Proxiable {
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address private immutable __self = address(this);

    /**
     * @dev The version of the upgrade interface of the contract. If this getter is missing, both `upgradeTo(address)`
     * and `upgradeToAndCall(address,bytes)` are present, and `upgradeTo` must be used if no function should be called,
     * while `upgradeToAndCall` will invoke the `receive` function if the second argument is the empty byte string.
     * If the getter returns `"5.0.0"`, only `upgradeToAndCall(address,bytes)` is present, and the second argument must
     * be the empty byte string if no function should be called, making it impossible to invoke the `receive` function
     * during an upgrade.
     */
    string public constant UPGRADE_INTERFACE_VERSION = "5.0.0";

    /**
     * @dev The call is from an unauthorized context.
     */
    error UUPSUnauthorizedCallContext();

    /**
     * @dev The storage `slot` is unsupported as a UUID.
     */
    error UUPSUnsupportedProxiableUUID(bytes32 slot);

    /**
     * @dev Check that the execution is being performed through a delegatecall call and that the execution context is
     * a proxy contract with an implementation (as defined in ERC1967) pointing to self. This should only be the case
     * for UUPS and transparent proxies that are using the current contract as their implementation. Execution of a
     * function through ERC1167 minimal proxies (clones) would not normally pass this test, but is not guaranteed to
     * fail.
     */
    modifier onlyProxy() {
        _checkProxy();
        _;
    }

    /**
     * @dev Check that the execution is not being performed through a delegate call. This allows a function to be
     * callable on the implementing contract but not through proxies.
     */
    modifier notDelegated() {
        _checkNotDelegated();
        _;
    }

    function __UUPSUpgradeable_init() internal onlyInitializing {
    }

    function __UUPSUpgradeable_init_unchained() internal onlyInitializing {
    }
    /**
     * @dev Implementation of the ERC1822 {proxiableUUID} function. This returns the storage slot used by the
     * implementation. It is used to validate the implementation's compatibility when performing an upgrade.
     *
     * IMPORTANT: A proxy pointing at a proxiable contract should not be considered proxiable itself, because this risks
     * bricking a proxy that upgrades to it, by delegating to itself until out of gas. Thus it is critical that this
     * function revert if invoked through a proxy. This is guaranteed by the `notDelegated` modifier.
     */
    function proxiableUUID() external view virtual notDelegated returns (bytes32) {
        return ERC1967Utils.IMPLEMENTATION_SLOT;
    }

    /**
     * @dev Upgrade the implementation of the proxy to `newImplementation`, and subsequently execute the function call
     * encoded in `data`.
     *
     * Calls {_authorizeUpgrade}.
     *
     * Emits an {Upgraded} event.
     *
     * @custom:oz-upgrades-unsafe-allow-reachable delegatecall
     */
    function upgradeToAndCall(address newImplementation, bytes memory data) public payable virtual onlyProxy {
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, data);
    }

    /**
     * @dev Reverts if the execution is not performed via delegatecall or the execution
     * context is not of a proxy with an ERC1967-compliant implementation pointing to self.
     * See {_onlyProxy}.
     */
    function _checkProxy() internal view virtual {
        if (
            address(this) == __self || // Must be called through delegatecall
            ERC1967Utils.getImplementation() != __self // Must be called through an active proxy
        ) {
            revert UUPSUnauthorizedCallContext();
        }
    }

    /**
     * @dev Reverts if the execution is performed via delegatecall.
     * See {notDelegated}.
     */
    function _checkNotDelegated() internal view virtual {
        if (address(this) != __self) {
            // Must not be called through delegatecall
            revert UUPSUnauthorizedCallContext();
        }
    }

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeToAndCall}.
     *
     * Normally, this function will use an xref:access.adoc[access control] modifier such as {Ownable-onlyOwner}.
     *
     * ```solidity
     * function _authorizeUpgrade(address) internal onlyOwner {}
     * ```
     */
    function _authorizeUpgrade(address newImplementation) internal virtual;

    /**
     * @dev Performs an implementation upgrade with a security check for UUPS proxies, and additional setup call.
     *
     * As a security check, {proxiableUUID} is invoked in the new implementation, and the return value
     * is expected to be the implementation slot in ERC1967.
     *
     * Emits an {IERC1967-Upgraded} event.
     */
    function _upgradeToAndCallUUPS(address newImplementation, bytes memory data) private {
        try IERC1822Proxiable(newImplementation).proxiableUUID() returns (bytes32 slot) {
            if (slot != ERC1967Utils.IMPLEMENTATION_SLOT) {
                revert UUPSUnsupportedProxiableUUID(slot);
            }
            ERC1967Utils.upgradeToAndCall(newImplementation, data);
        } catch {
            // The implementation is not UUPS
            revert ERC1967Utils.ERC1967InvalidImplementation(newImplementation);
        }
    }
}


// File @openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/Pausable.sol)

pragma solidity ^0.8.20;


/**
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotPaused` and `whenPaused`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
abstract contract PausableUpgradeable is Initializable, ContextUpgradeable {
    /// @custom:storage-location erc7201:openzeppelin.storage.Pausable
    struct PausableStorage {
        bool _paused;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Pausable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant PausableStorageLocation = 0xcd5ed15c6e187e77e9aee88184c21f4f2182ab5827cb3b7e07fbedcd63f03300;

    function _getPausableStorage() private pure returns (PausableStorage storage $) {
        assembly {
            $.slot := PausableStorageLocation
        }
    }

    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by `account`.
     */
    event Unpaused(address account);

    /**
     * @dev The operation failed because the contract is paused.
     */
    error EnforcedPause();

    /**
     * @dev The operation failed because the contract is not paused.
     */
    error ExpectedPause();

    /**
     * @dev Initializes the contract in unpaused state.
     */
    function __Pausable_init() internal onlyInitializing {
        __Pausable_init_unchained();
    }

    function __Pausable_init_unchained() internal onlyInitializing {
        PausableStorage storage $ = _getPausableStorage();
        $._paused = false;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() {
        _requirePaused();
        _;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual returns (bool) {
        PausableStorage storage $ = _getPausableStorage();
        return $._paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused() internal view virtual {
        if (paused()) {
            revert EnforcedPause();
        }
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused() internal view virtual {
        if (!paused()) {
            revert ExpectedPause();
        }
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _pause() internal virtual whenNotPaused {
        PausableStorage storage $ = _getPausableStorage();
        $._paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function _unpause() internal virtual whenPaused {
        PausableStorage storage $ = _getPausableStorage();
        $._paused = false;
        emit Unpaused(_msgSender());
    }
}


// File @openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuardUpgradeable is Initializable {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /// @custom:storage-location erc7201:openzeppelin.storage.ReentrancyGuard
    struct ReentrancyGuardStorage {
        uint256 _status;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ReentrancyGuardStorageLocation = 0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    function _getReentrancyGuardStorage() private pure returns (ReentrancyGuardStorage storage $) {
        assembly {
            $.slot := ReentrancyGuardStorageLocation
        }
    }

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    function __ReentrancyGuard_init() internal onlyInitializing {
        __ReentrancyGuard_init_unchained();
    }

    function __ReentrancyGuard_init_unchained() internal onlyInitializing {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        $._status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if ($._status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        $._status = ENTERED;
    }

    function _nonReentrantAfter() private {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        $._status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        return $._status == ENTERED;
    }
}


// File @openzeppelin/contracts/utils/math/Math.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/math/Math.sol)

pragma solidity ^0.8.20;

/**
 * @dev Standard math utilities missing in the Solidity language.
 */
library Math {
    /**
     * @dev Muldiv operation overflow.
     */
    error MathOverflowedMulDiv();

    enum Rounding {
        Floor, // Toward negative infinity
        Ceil, // Toward positive infinity
        Trunc, // Toward zero
        Expand // Away from zero
    }

    /**
     * @dev Returns the addition of two unsigned integers, with an overflow flag.
     */
    function tryAdd(uint256 a, uint256 b) internal pure returns (bool, uint256) {
        unchecked {
            uint256 c = a + b;
            if (c < a) return (false, 0);
            return (true, c);
        }
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, with an overflow flag.
     */
    function trySub(uint256 a, uint256 b) internal pure returns (bool, uint256) {
        unchecked {
            if (b > a) return (false, 0);
            return (true, a - b);
        }
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, with an overflow flag.
     */
    function tryMul(uint256 a, uint256 b) internal pure returns (bool, uint256) {
        unchecked {
            // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
            // benefit is lost if 'b' is also tested.
            // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
            if (a == 0) return (true, 0);
            uint256 c = a * b;
            if (c / a != b) return (false, 0);
            return (true, c);
        }
    }

    /**
     * @dev Returns the division of two unsigned integers, with a division by zero flag.
     */
    function tryDiv(uint256 a, uint256 b) internal pure returns (bool, uint256) {
        unchecked {
            if (b == 0) return (false, 0);
            return (true, a / b);
        }
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers, with a division by zero flag.
     */
    function tryMod(uint256 a, uint256 b) internal pure returns (bool, uint256) {
        unchecked {
            if (b == 0) return (false, 0);
            return (true, a % b);
        }
    }

    /**
     * @dev Returns the largest of two numbers.
     */
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     * @dev Returns the average of two numbers. The result is rounded towards
     * zero.
     */
    function average(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a + b) / 2 can overflow.
        return (a & b) + (a ^ b) / 2;
    }

    /**
     * @dev Returns the ceiling of the division of two numbers.
     *
     * This differs from standard division with `/` in that it rounds towards infinity instead
     * of rounding towards zero.
     */
    function ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        if (b == 0) {
            // Guarantee the same behavior as in a regular Solidity division.
            return a / b;
        }

        // (a + b - 1) / b can overflow on addition, so we distribute.
        return a == 0 ? 0 : (a - 1) / b + 1;
    }

    /**
     * @notice Calculates floor(x * y / denominator) with full precision. Throws if result overflows a uint256 or
     * denominator == 0.
     * @dev Original credit to Remco Bloemen under MIT license (https://xn--2-umb.com/21/muldiv) with further edits by
     * Uniswap Labs also under MIT license.
     */
    function mulDiv(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        unchecked {
            // 512-bit multiply [prod1 prod0] = x * y. Compute the product mod 2^256 and mod 2^256 - 1, then use
            // use the Chinese Remainder Theorem to reconstruct the 512 bit result. The result is stored in two 256
            // variables such that product = prod1 * 2^256 + prod0.
            uint256 prod0 = x * y; // Least significant 256 bits of the product
            uint256 prod1; // Most significant 256 bits of the product
            assembly {
                let mm := mulmod(x, y, not(0))
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }

            // Handle non-overflow cases, 256 by 256 division.
            if (prod1 == 0) {
                // Solidity will revert if denominator == 0, unlike the div opcode on its own.
                // The surrounding unchecked block does not change this fact.
                // See https://docs.soliditylang.org/en/latest/control-structures.html#checked-or-unchecked-arithmetic.
                return prod0 / denominator;
            }

            // Make sure the result is less than 2^256. Also prevents denominator == 0.
            if (denominator <= prod1) {
                revert MathOverflowedMulDiv();
            }

            ///////////////////////////////////////////////
            // 512 by 256 division.
            ///////////////////////////////////////////////

            // Make division exact by subtracting the remainder from [prod1 prod0].
            uint256 remainder;
            assembly {
                // Compute remainder using mulmod.
                remainder := mulmod(x, y, denominator)

                // Subtract 256 bit number from 512 bit number.
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }

            // Factor powers of two out of denominator and compute largest power of two divisor of denominator.
            // Always >= 1. See https://cs.stackexchange.com/q/138556/92363.

            uint256 twos = denominator & (0 - denominator);
            assembly {
                // Divide denominator by twos.
                denominator := div(denominator, twos)

                // Divide [prod1 prod0] by twos.
                prod0 := div(prod0, twos)

                // Flip twos such that it is 2^256 / twos. If twos is zero, then it becomes one.
                twos := add(div(sub(0, twos), twos), 1)
            }

            // Shift in bits from prod1 into prod0.
            prod0 |= prod1 * twos;

            // Invert denominator mod 2^256. Now that denominator is an odd number, it has an inverse modulo 2^256 such
            // that denominator * inv = 1 mod 2^256. Compute the inverse by starting with a seed that is correct for
            // four bits. That is, denominator * inv = 1 mod 2^4.
            uint256 inverse = (3 * denominator) ^ 2;

            // Use the Newton-Raphson iteration to improve the precision. Thanks to Hensel's lifting lemma, this also
            // works in modular arithmetic, doubling the correct bits in each step.
            inverse *= 2 - denominator * inverse; // inverse mod 2^8
            inverse *= 2 - denominator * inverse; // inverse mod 2^16
            inverse *= 2 - denominator * inverse; // inverse mod 2^32
            inverse *= 2 - denominator * inverse; // inverse mod 2^64
            inverse *= 2 - denominator * inverse; // inverse mod 2^128
            inverse *= 2 - denominator * inverse; // inverse mod 2^256

            // Because the division is now exact we can divide by multiplying with the modular inverse of denominator.
            // This will give us the correct result modulo 2^256. Since the preconditions guarantee that the outcome is
            // less than 2^256, this is the final result. We don't need to compute the high bits of the result and prod1
            // is no longer required.
            result = prod0 * inverse;
            return result;
        }
    }

    /**
     * @notice Calculates x * y / denominator with full precision, following the selected rounding direction.
     */
    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding) internal pure returns (uint256) {
        uint256 result = mulDiv(x, y, denominator);
        if (unsignedRoundsUp(rounding) && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
        return result;
    }

    /**
     * @dev Returns the square root of a number. If the number is not a perfect square, the value is rounded
     * towards zero.
     *
     * Inspired by Henry S. Warren, Jr.'s "Hacker's Delight" (Chapter 11).
     */
    function sqrt(uint256 a) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        // For our first guess, we get the biggest power of 2 which is smaller than the square root of the target.
        //
        // We know that the "msb" (most significant bit) of our target number `a` is a power of 2 such that we have
        // `msb(a) <= a < 2*msb(a)`. This value can be written `msb(a)=2**k` with `k=log2(a)`.
        //
        // This can be rewritten `2**log2(a) <= a < 2**(log2(a) + 1)`
        // → `sqrt(2**k) <= sqrt(a) < sqrt(2**(k+1))`
        // → `2**(k/2) <= sqrt(a) < 2**((k+1)/2) <= 2**(k/2 + 1)`
        //
        // Consequently, `2**(log2(a) / 2)` is a good first approximation of `sqrt(a)` with at least 1 correct bit.
        uint256 result = 1 << (log2(a) >> 1);

        // At this point `result` is an estimation with one bit of precision. We know the true value is a uint128,
        // since it is the square root of a uint256. Newton's method converges quadratically (precision doubles at
        // every iteration). We thus need at most 7 iteration to turn our partial result with one bit of precision
        // into the expected uint128 result.
        unchecked {
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            return min(result, a / result);
        }
    }

    /**
     * @notice Calculates sqrt(a), following the selected rounding direction.
     */
    function sqrt(uint256 a, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = sqrt(a);
            return result + (unsignedRoundsUp(rounding) && result * result < a ? 1 : 0);
        }
    }

    /**
     * @dev Return the log in base 2 of a positive value rounded towards zero.
     * Returns 0 if given 0.
     */
    function log2(uint256 value) internal pure returns (uint256) {
        uint256 result = 0;
        unchecked {
            if (value >> 128 > 0) {
                value >>= 128;
                result += 128;
            }
            if (value >> 64 > 0) {
                value >>= 64;
                result += 64;
            }
            if (value >> 32 > 0) {
                value >>= 32;
                result += 32;
            }
            if (value >> 16 > 0) {
                value >>= 16;
                result += 16;
            }
            if (value >> 8 > 0) {
                value >>= 8;
                result += 8;
            }
            if (value >> 4 > 0) {
                value >>= 4;
                result += 4;
            }
            if (value >> 2 > 0) {
                value >>= 2;
                result += 2;
            }
            if (value >> 1 > 0) {
                result += 1;
            }
        }
        return result;
    }

    /**
     * @dev Return the log in base 2, following the selected rounding direction, of a positive value.
     * Returns 0 if given 0.
     */
    function log2(uint256 value, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = log2(value);
            return result + (unsignedRoundsUp(rounding) && 1 << result < value ? 1 : 0);
        }
    }

    /**
     * @dev Return the log in base 10 of a positive value rounded towards zero.
     * Returns 0 if given 0.
     */
    function log10(uint256 value) internal pure returns (uint256) {
        uint256 result = 0;
        unchecked {
            if (value >= 10 ** 64) {
                value /= 10 ** 64;
                result += 64;
            }
            if (value >= 10 ** 32) {
                value /= 10 ** 32;
                result += 32;
            }
            if (value >= 10 ** 16) {
                value /= 10 ** 16;
                result += 16;
            }
            if (value >= 10 ** 8) {
                value /= 10 ** 8;
                result += 8;
            }
            if (value >= 10 ** 4) {
                value /= 10 ** 4;
                result += 4;
            }
            if (value >= 10 ** 2) {
                value /= 10 ** 2;
                result += 2;
            }
            if (value >= 10 ** 1) {
                result += 1;
            }
        }
        return result;
    }

    /**
     * @dev Return the log in base 10, following the selected rounding direction, of a positive value.
     * Returns 0 if given 0.
     */
    function log10(uint256 value, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = log10(value);
            return result + (unsignedRoundsUp(rounding) && 10 ** result < value ? 1 : 0);
        }
    }

    /**
     * @dev Return the log in base 256 of a positive value rounded towards zero.
     * Returns 0 if given 0.
     *
     * Adding one to the result gives the number of pairs of hex symbols needed to represent `value` as a hex string.
     */
    function log256(uint256 value) internal pure returns (uint256) {
        uint256 result = 0;
        unchecked {
            if (value >> 128 > 0) {
                value >>= 128;
                result += 16;
            }
            if (value >> 64 > 0) {
                value >>= 64;
                result += 8;
            }
            if (value >> 32 > 0) {
                value >>= 32;
                result += 4;
            }
            if (value >> 16 > 0) {
                value >>= 16;
                result += 2;
            }
            if (value >> 8 > 0) {
                result += 1;
            }
        }
        return result;
    }

    /**
     * @dev Return the log in base 256, following the selected rounding direction, of a positive value.
     * Returns 0 if given 0.
     */
    function log256(uint256 value, Rounding rounding) internal pure returns (uint256) {
        unchecked {
            uint256 result = log256(value);
            return result + (unsignedRoundsUp(rounding) && 1 << (result << 3) < value ? 1 : 0);
        }
    }

    /**
     * @dev Returns whether a provided rounding mode is considered rounding up for unsigned integers.
     */
    function unsignedRoundsUp(Rounding rounding) internal pure returns (bool) {
        return uint8(rounding) % 2 == 1;
    }
}


// File @openzeppelin/contracts/utils/structs/EnumerableSet.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/structs/EnumerableSet.sol)
// This file was procedurally generated from scripts/generate/templates/EnumerableSet.js.

pragma solidity ^0.8.20;

/**
 * @dev Library for managing
 * https://en.wikipedia.org/wiki/Set_(abstract_data_type)[sets] of primitive
 * types.
 *
 * Sets have the following properties:
 *
 * - Elements are added, removed, and checked for existence in constant time
 * (O(1)).
 * - Elements are enumerated in O(n). No guarantees are made on the ordering.
 *
 * ```solidity
 * contract Example {
 *     // Add the library methods
 *     using EnumerableSet for EnumerableSet.AddressSet;
 *
 *     // Declare a set state variable
 *     EnumerableSet.AddressSet private mySet;
 * }
 * ```
 *
 * As of v3.3.0, sets of type `bytes32` (`Bytes32Set`), `address` (`AddressSet`)
 * and `uint256` (`UintSet`) are supported.
 *
 * [WARNING]
 * ====
 * Trying to delete such a structure from storage will likely result in data corruption, rendering the structure
 * unusable.
 * See https://github.com/ethereum/solidity/pull/11843[ethereum/solidity#11843] for more info.
 *
 * In order to clean an EnumerableSet, you can either remove all elements one by one or create a fresh instance using an
 * array of EnumerableSet.
 * ====
 */
library EnumerableSet {
    // To implement this library for multiple types with as little code
    // repetition as possible, we write it in terms of a generic Set type with
    // bytes32 values.
    // The Set implementation uses private functions, and user-facing
    // implementations (such as AddressSet) are just wrappers around the
    // underlying Set.
    // This means that we can only create new EnumerableSets for types that fit
    // in bytes32.

    struct Set {
        // Storage of set values
        bytes32[] _values;
        // Position is the index of the value in the `values` array plus 1.
        // Position 0 is used to mean a value is not in the set.
        mapping(bytes32 value => uint256) _positions;
    }

    /**
     * @dev Add a value to a set. O(1).
     *
     * Returns true if the value was added to the set, that is if it was not
     * already present.
     */
    function _add(Set storage set, bytes32 value) private returns (bool) {
        if (!_contains(set, value)) {
            set._values.push(value);
            // The value is stored at length-1, but we add 1 to all indexes
            // and use 0 as a sentinel value
            set._positions[value] = set._values.length;
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Removes a value from a set. O(1).
     *
     * Returns true if the value was removed from the set, that is if it was
     * present.
     */
    function _remove(Set storage set, bytes32 value) private returns (bool) {
        // We cache the value's position to prevent multiple reads from the same storage slot
        uint256 position = set._positions[value];

        if (position != 0) {
            // Equivalent to contains(set, value)
            // To delete an element from the _values array in O(1), we swap the element to delete with the last one in
            // the array, and then remove the last element (sometimes called as 'swap and pop').
            // This modifies the order of the array, as noted in {at}.

            uint256 valueIndex = position - 1;
            uint256 lastIndex = set._values.length - 1;

            if (valueIndex != lastIndex) {
                bytes32 lastValue = set._values[lastIndex];

                // Move the lastValue to the index where the value to delete is
                set._values[valueIndex] = lastValue;
                // Update the tracked position of the lastValue (that was just moved)
                set._positions[lastValue] = position;
            }

            // Delete the slot where the moved value was stored
            set._values.pop();

            // Delete the tracked position for the deleted slot
            delete set._positions[value];

            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Returns true if the value is in the set. O(1).
     */
    function _contains(Set storage set, bytes32 value) private view returns (bool) {
        return set._positions[value] != 0;
    }

    /**
     * @dev Returns the number of values on the set. O(1).
     */
    function _length(Set storage set) private view returns (uint256) {
        return set._values.length;
    }

    /**
     * @dev Returns the value stored at position `index` in the set. O(1).
     *
     * Note that there are no guarantees on the ordering of values inside the
     * array, and it may change when more values are added or removed.
     *
     * Requirements:
     *
     * - `index` must be strictly less than {length}.
     */
    function _at(Set storage set, uint256 index) private view returns (bytes32) {
        return set._values[index];
    }

    /**
     * @dev Return the entire set in an array
     *
     * WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
     * to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
     * this function has an unbounded cost, and using it as part of a state-changing function may render the function
     * uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block.
     */
    function _values(Set storage set) private view returns (bytes32[] memory) {
        return set._values;
    }

    // Bytes32Set

    struct Bytes32Set {
        Set _inner;
    }

    /**
     * @dev Add a value to a set. O(1).
     *
     * Returns true if the value was added to the set, that is if it was not
     * already present.
     */
    function add(Bytes32Set storage set, bytes32 value) internal returns (bool) {
        return _add(set._inner, value);
    }

    /**
     * @dev Removes a value from a set. O(1).
     *
     * Returns true if the value was removed from the set, that is if it was
     * present.
     */
    function remove(Bytes32Set storage set, bytes32 value) internal returns (bool) {
        return _remove(set._inner, value);
    }

    /**
     * @dev Returns true if the value is in the set. O(1).
     */
    function contains(Bytes32Set storage set, bytes32 value) internal view returns (bool) {
        return _contains(set._inner, value);
    }

    /**
     * @dev Returns the number of values in the set. O(1).
     */
    function length(Bytes32Set storage set) internal view returns (uint256) {
        return _length(set._inner);
    }

    /**
     * @dev Returns the value stored at position `index` in the set. O(1).
     *
     * Note that there are no guarantees on the ordering of values inside the
     * array, and it may change when more values are added or removed.
     *
     * Requirements:
     *
     * - `index` must be strictly less than {length}.
     */
    function at(Bytes32Set storage set, uint256 index) internal view returns (bytes32) {
        return _at(set._inner, index);
    }

    /**
     * @dev Return the entire set in an array
     *
     * WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
     * to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
     * this function has an unbounded cost, and using it as part of a state-changing function may render the function
     * uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block.
     */
    function values(Bytes32Set storage set) internal view returns (bytes32[] memory) {
        bytes32[] memory store = _values(set._inner);
        bytes32[] memory result;

        /// @solidity memory-safe-assembly
        assembly {
            result := store
        }

        return result;
    }

    // AddressSet

    struct AddressSet {
        Set _inner;
    }

    /**
     * @dev Add a value to a set. O(1).
     *
     * Returns true if the value was added to the set, that is if it was not
     * already present.
     */
    function add(AddressSet storage set, address value) internal returns (bool) {
        return _add(set._inner, bytes32(uint256(uint160(value))));
    }

    /**
     * @dev Removes a value from a set. O(1).
     *
     * Returns true if the value was removed from the set, that is if it was
     * present.
     */
    function remove(AddressSet storage set, address value) internal returns (bool) {
        return _remove(set._inner, bytes32(uint256(uint160(value))));
    }

    /**
     * @dev Returns true if the value is in the set. O(1).
     */
    function contains(AddressSet storage set, address value) internal view returns (bool) {
        return _contains(set._inner, bytes32(uint256(uint160(value))));
    }

    /**
     * @dev Returns the number of values in the set. O(1).
     */
    function length(AddressSet storage set) internal view returns (uint256) {
        return _length(set._inner);
    }

    /**
     * @dev Returns the value stored at position `index` in the set. O(1).
     *
     * Note that there are no guarantees on the ordering of values inside the
     * array, and it may change when more values are added or removed.
     *
     * Requirements:
     *
     * - `index` must be strictly less than {length}.
     */
    function at(AddressSet storage set, uint256 index) internal view returns (address) {
        return address(uint160(uint256(_at(set._inner, index))));
    }

    /**
     * @dev Return the entire set in an array
     *
     * WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
     * to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
     * this function has an unbounded cost, and using it as part of a state-changing function may render the function
     * uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block.
     */
    function values(AddressSet storage set) internal view returns (address[] memory) {
        bytes32[] memory store = _values(set._inner);
        address[] memory result;

        /// @solidity memory-safe-assembly
        assembly {
            result := store
        }

        return result;
    }

    // UintSet

    struct UintSet {
        Set _inner;
    }

    /**
     * @dev Add a value to a set. O(1).
     *
     * Returns true if the value was added to the set, that is if it was not
     * already present.
     */
    function add(UintSet storage set, uint256 value) internal returns (bool) {
        return _add(set._inner, bytes32(value));
    }

    /**
     * @dev Removes a value from a set. O(1).
     *
     * Returns true if the value was removed from the set, that is if it was
     * present.
     */
    function remove(UintSet storage set, uint256 value) internal returns (bool) {
        return _remove(set._inner, bytes32(value));
    }

    /**
     * @dev Returns true if the value is in the set. O(1).
     */
    function contains(UintSet storage set, uint256 value) internal view returns (bool) {
        return _contains(set._inner, bytes32(value));
    }

    /**
     * @dev Returns the number of values in the set. O(1).
     */
    function length(UintSet storage set) internal view returns (uint256) {
        return _length(set._inner);
    }

    /**
     * @dev Returns the value stored at position `index` in the set. O(1).
     *
     * Note that there are no guarantees on the ordering of values inside the
     * array, and it may change when more values are added or removed.
     *
     * Requirements:
     *
     * - `index` must be strictly less than {length}.
     */
    function at(UintSet storage set, uint256 index) internal view returns (uint256) {
        return uint256(_at(set._inner, index));
    }

    /**
     * @dev Return the entire set in an array
     *
     * WARNING: This operation will copy the entire storage to memory, which can be quite expensive. This is designed
     * to mostly be used by view accessors that are queried without any gas fees. Developers should keep in mind that
     * this function has an unbounded cost, and using it as part of a state-changing function may render the function
     * uncallable if the set grows to a point where copying to memory consumes too much gas to fit in a block.
     */
    function values(UintSet storage set) internal view returns (uint256[] memory) {
        bytes32[] memory store = _values(set._inner);
        uint256[] memory result;

        /// @solidity memory-safe-assembly
        assembly {
            result := store
        }

        return result;
    }
}


// File @openzeppelin/contracts/token/ERC20/IERC20.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/IERC20.sol)

pragma solidity ^0.8.20;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}


// File contracts/dataLiquidityPool/interfaces/IDataLiquidityPool.sol

pragma solidity ^0.8.24;


interface IDataLiquidityPool is IAccessControl {
    enum ValidatorStatus {
        None,
        Registered,
        Active,
        Deregistered,
        Inactive,
        Blocked
    }

    struct ValidatorInfo {
        address payable ownerAddress;
        uint256 stakeAmount;
        ValidatorStatus status;
        uint256 filesToVerifyIndex;
        uint256 filesToVerifyCount;
        mapping(uint256 => uint256) filesToVerify;
        mapping(address => uint256) weights;
    }

    struct FileVerificationInfo {
        address validatorAddress;
        uint256 timespatmp;
        uint256 score;
        string metadata;
    }

    struct File {
        address ownerAddress;
        uint256 addedTimestamp;
        uint256 verificationsCount;
        string url;
        string encryptedKey;
        mapping(uint256 => FileVerificationInfo) verifications;
    }

    struct ValidatorReward {
        uint256 share;
        uint256 withdrawnAmount;
    }

    struct Epoch {
        uint256 startBlock;
        uint256 endBlock;
        uint256 reward;
        uint256 validatorsListId;
        mapping(address => ValidatorReward) validatorRewards;
    }

    function masterKey() external view returns (string memory);
    function maxNumberOfValidators() external view returns (uint256);
    function epochSize() external view returns (uint256);
    function validationPeriod() external view returns (uint256);
    function validatorScoreMinTrust() external view returns (uint256);
    function validatorScoreKappa() external view returns (uint256);
    function validatorScoreRho() external view returns (uint256);
    function activeValidatorsListsCount() external view returns (uint256);
    function epochsCount() external view returns (uint256);
    function minStakeAmount() external view returns (uint256);
    function totalStaked() external view returns (uint256);
    function totalRewardAmount() external view returns (uint256);
    function epochRewardAmount() external view returns (uint256);
    function addingFilePaused() external view returns (bool);

    function updateMaxNumberOfValidators(uint256 newMaxNumberOfValidators) external;
    function updateEpochSize(uint256 newEpochSize) external;
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external;
    function updateValidationPeriod(uint256 newValidationPeriod) external;
    function updateValidatorScoreMinTrust(uint256 newValidatorScoreMinTrust) external;
    function updateValidatorScoreKappa(uint256 newValidatorScoreKappa) external;
    function updateValidatorScoreRho(uint256 newValidatorScoreRho) external;

    function activeValidatorsLists(
        uint256 id
    ) external view returns (address[] memory);
    function validatorInfo(
        address validatorAddress
    )
        external
        view
        returns (
            address ownerAddress,
            uint256 stakeAmount,
            ValidatorStatus status,
            uint256 filesToVerifyIndex,
            uint256 filesToVerifyCount
        );
    function fileVerifications(
        uint256 fileId,
        uint256 verificationId
    )
        external
        view
        returns (
            address validatorAddress,
            uint256 timespatmp,
            uint256 score,
            string memory metadata
        );
    function createEpochs() external;
    function createEpochsUntilBlockNumber(uint256 blockNumber) external;
    function registerValidator(
        address validatorAddress,
        address payable ownerAddress
    ) external payable;
    struct NextFileToVerify {
        uint256 fileId;
        string url;
        string encryptedKey;
        uint256 addedTime;
        address assignedValidator;
    }
    function getNextFileToVerify(
        address validatorAddress
    ) external view returns (NextFileToVerify memory);
    function files(
        uint256 fileId
    )
        external
        view
        returns (
            address ownerAddress,
            string memory url,
            string memory encryptedKey,
            uint256 addedTimestamp,
            uint256 verificationsCount
        );
}


// File contracts/dataLiquidityPool/interfaces/DataLiquidityPoolStorageV1.sol

pragma solidity ^0.8.24;


/**
 * @title Storage for DataLiquidityPool
 * @notice For future upgrades, do not change DataLiquidityPoolV1. Create a new
 * contract which implements DataLiquidityPoolV1
 */
abstract contract DataLiquidityPoolStorageV1 is IDataLiquidityPool {
    string public override masterKey;
    uint256 public override maxNumberOfValidators;
    uint256 public override minStakeAmount;
    uint256 public override totalStaked;
    uint256 public override totalRewardAmount;
    uint256 public override epochRewardAmount;
    uint256 public override epochSize;
    uint256 public override validationPeriod;
    uint256 public override validatorScoreMinTrust;
    uint256 public override validatorScoreKappa;
    uint256 public override validatorScoreRho;

    bool public override addingFilePaused;

    mapping(address => ValidatorInfo) internal _validatorInfo;
    EnumerableSet.AddressSet internal _validators;

    uint256 public override activeValidatorsListsCount;
    mapping(uint256 => EnumerableSet.AddressSet) internal _activeValidatorsLists;
    EnumerableSet.AddressSet internal _validatorsWithFilesToVerify;

    mapping(uint256 => File) internal _files;
    EnumerableSet.Bytes32Set internal _fileUrlHases;

    uint256 public override epochsCount;
    mapping(uint256 => Epoch) internal _epochs;
}


// File contracts/dataLiquidityPool/DataLiquidityPool.sol

pragma solidity ^0.8.24;







contract DataLiquidityPool is
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
     * @param validatorAddress                         address of the validator
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
     * @param validatorAddress                        address of the validator
     * @param ownerAddress                       owner of the validator
     * @param amount                            amount staked in this call
     */
    event ValidatorRegistered(
        address indexed validatorAddress,
        address indexed ownerAddress,
        uint256 amount
    );

    /**
     * @notice Triggered when a validator has been unregistered
     *
     * @param validatorAddress                   address of the validator
     */
    event ValidatorUnregisterd(address indexed validatorAddress);

    /**
     * @notice Triggered when a validator has been approved
     *
     * @param validatorAddress                   address of the validator
     */
    event ValidatorApproved(address indexed validatorAddress);

    /**
     * @notice Triggered when a validator has been deregistered
     *
     * @param validatorAddress                   address of the validator
     */
    event ValidatorDeregistered(address indexed validatorAddress);

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
     * @notice Triggered when a epoch has been created
     *
     * @param epochId                  reward epoch id
     */
    event EpochCreated(uint256 epochId);

    /**
     * @notice Triggered when a validator has updated its weights
     *
     * @param validatorAddress                   address of the validator
     * @param validators                         validators
     * @param weights                            weights
     */
    event WeightsUpdated(
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
     * @notice Triggered when the validation period has been updated
     *
     * @param newValidationPeriod                new validation period
     */
    event ValidationPeriodUpdated(uint256 newValidationPeriod);

    /**
     * @notice Triggered when the validatorScoreMinTrust has been updated
     *
     * @param newValidatorScoreMinTrust                new validatorScoreMinTrust
     */
    event ValidatorScoreMinTrustUpdated(uint256 newValidatorScoreMinTrust);

    /**
     * @notice Triggered when the validatorScoreKappa has been updated
     *
     * @param newValidatorScoreKappa                new validatorScoreKappa
     */
    event ValidatorScoreKappaUpdated(uint256 newValidatorScoreKappa);

    /**
     * @notice Triggered when the validatorScoreRho has been updated
     *
     * @param newValidatorScoreRho                new validatorScoreRho
     */
    event ValidatorScoreRhoUpdated(uint256 newValidatorScoreRho);

    error InvalidStakeAmount();
    error ValidatorAlreadyRegistered();
    error ValidatorNotRegistered();
    error TooManyValidators();
    error NotValidator();
    error MasterKeyAlreadySet();
    error FileAlreadyAdded();
    error FileAlreadyVerified();
    error InvalidFileId();
    error ArityMismatch();
    error NotValidatorColdKey();
    error AddingFilePaused();

    /**
     * @dev Modifier to make a function callable only when the caller is an active validator
     */
    modifier onlyActiveValidators() {
        if (_validatorInfo[msg.sender].status != ValidatorStatus.Active) {
            revert NotValidator();
        }
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the caller is the cold key of the validator
     *
     * @param validatorAddress                         address of the validator
     */
    modifier onlyValidatorOwnerAddress(address validatorAddress) {
        if (_validatorInfo[validatorAddress].ownerAddress != msg.sender) {
            revert NotValidatorColdKey();
        }
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the adding file is not paused
     */
    modifier whenAddingFileNotPaused() {
        if (addingFilePaused) {
            revert AddingFilePaused();
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
     * @param newEpochSize                       epoch size size
     * @param newEpochRewardAmount               reward amount
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
        uint256 newEpochSize,
        uint256 newEpochRewardAmount
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
        epochSize = newEpochSize;
        epochRewardAmount = newEpochRewardAmount;

        _epochs[1].startBlock = startBlock;
        _epochs[1].endBlock = startBlock + newEpochSize - 1;
        _epochs[1].reward = newEpochRewardAmount;
        epochsCount++;

        emit EpochCreated(1);

        addingFilePaused = true;
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
    function version() external pure returns (uint256) {
        return 1;
    }

    /**
     * @notice Get the number of files
     */
    function filesCount() external view returns (uint256) {
        return _fileUrlHases.length();
    }

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
            uint256 addedTimestamp,
            uint256 verificationsCount
        )
    {
        return (
            _files[fileId].ownerAddress,
            _files[fileId].url,
            _files[fileId].encryptedKey,
            _files[fileId].addedTimestamp,
            _files[fileId].verificationsCount
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
     * @param validatorAddress                         address of the validator
     */
    function validatorInfo(
        address validatorAddress
    )
        external
        view
        override
        returns (
            address ownerAddress,
            uint256 stakeAmount,
            ValidatorStatus status,
            uint256 filesToVerifyIndex,
            uint256 filesToVerifyCount
        )
    {
        ownerAddress = _validatorInfo[validatorAddress].ownerAddress;
        stakeAmount = _validatorInfo[validatorAddress].stakeAmount;
        status = _validatorInfo[validatorAddress].status;
        filesToVerifyIndex = _validatorInfo[validatorAddress].filesToVerifyIndex;
        filesToVerifyCount = _validatorInfo[validatorAddress].filesToVerifyCount;
    }

    /**
     * @notice Get the next file to verify
     *
     * @param validatorAddress                   address of the validator
     */
    function getNextFileToVerify(
        address validatorAddress
    ) public view override returns (NextFileToVerify memory) {
        if (
            _validatorInfo[validatorAddress].status != ValidatorStatus.Active
        ) {
            revert NotValidator();
        }

        ValidatorInfo storage validator = _validatorInfo[validatorAddress];
        uint256 nextFileId = validator.filesToVerify[
            validator.filesToVerifyIndex + 1
        ];

        File storage file = _files[nextFileId];

        if (
            nextFileId > 0 &&
            file.addedTimestamp + validationPeriod < block.timestamp
        ) {
            return NextFileToVerify(
                nextFileId,
                file.url,
                file.encryptedKey,
                file.addedTimestamp,
                validatorAddress
            );
        }

        address assignedValidator = validatorAddress;

        uint256 validatorsWithFilesToVerifyCount = _validatorsWithFilesToVerify
            .length();

        File storage otherValidatorFile;
        for (
            uint256 index = 0;
            index < validatorsWithFilesToVerifyCount;
            index++
        ) {
            validator = _validatorInfo[_validatorsWithFilesToVerify.at(index)];

            uint256 otherValidatorNextFileId = validator.filesToVerify[
                validator.filesToVerifyIndex + 1
            ];

            otherValidatorFile = _files[otherValidatorNextFileId];

            if (
                otherValidatorNextFileId > 0 &&
                otherValidatorFile.addedTimestamp + validationPeriod <
                block.timestamp &&
                otherValidatorFile.addedTimestamp < file.addedTimestamp
            ) {
                nextFileId = otherValidatorNextFileId;
                file = otherValidatorFile;
                assignedValidator = _validatorsWithFilesToVerify.at(index);
            }
        }

        return NextFileToVerify(
            nextFileId,
            file.url,
            file.encryptedKey,
            file.addedTimestamp,
            assignedValidator
        );
    }

    /**
     * @notice Get epoch information
     *
     * @param epochId                         epoch id
     */
    function epochs(
        uint256 epochId
    )
        external
        view
        returns (
            uint256 startBlock,
            uint256 endBlock,
            uint256 reward,
            uint256 validatorsListId
        )
    {
        return (
            _epochs[epochId].startBlock,
            _epochs[epochId].endBlock,
            _epochs[epochId].reward,
            _epochs[epochId].validatorsListId
        );
    }

    /**
     * @notice Get active validator list by listId
     */
    function activeValidatorsLists(
        uint256 id
    ) public view override returns (address[] memory) {
        return _activeValidatorsLists[id].values();
    }

    /**
     * @notice Get a list with all registeres validators)
     */
    function validatorsCount() public view returns (uint256) {
        return _validators.length();
    }

    /**
     * @notice Get the epoch rewards
     *
     * @param epochId                              epoch id
     *
     * @return validators                          validators
     * @return shares                              rewards
     */
    function epochRewards(
        uint256 epochId
    )
        external
        view
        returns (
            address[] memory validators,
            uint256[] memory shares,
            uint256[] memory withdrawnAmounts
        )
    {
        EnumerableSet.AddressSet
            storage epochValidators = _activeValidatorsLists[
                _epochs[epochId].validatorsListId
            ];

        uint256 epochValidatorsCount = epochValidators.length();

        validators = new address[](epochValidatorsCount);
        shares = new uint256[](epochValidatorsCount);
        withdrawnAmounts = new uint256[](epochValidatorsCount);

        Epoch storage epoch = _epochs[epochId];

        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            validators[i] = epochValidators.at(i);
            shares[i] =           epoch.validatorRewards[validators[i]].share;
            withdrawnAmounts[i] = epoch.validatorRewards[validators[i]].withdrawnAmount;
        }
    }

    /**
     * @notice Get weights assigned by the validator
     */
    function validatorWeights(
        address validatorAddress
    )
        external
        view
        returns (address[] memory validators, uint256[] memory weights)
    {
        ValidatorInfo storage validator = _validatorInfo[validatorAddress];

        EnumerableSet.AddressSet
            storage epochValidators = _activeValidatorsLists[
                _epochs[epochsCount].validatorsListId
            ];

        uint256 epochValidatorsCount = epochValidators.length();

        weights = new uint256[](epochValidatorsCount);
        validators = new address[](epochValidatorsCount);

        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            validators[i] = epochValidators.at(i);
            weights[i] = validator.weights[epochValidators.at(i)];
        }
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

    /**
     * @notice Update the maximum number of validators
     *
     * @param newMaxNumberOfValidators           new maximum number of validators
     */
    function updateMaxNumberOfValidators(
        uint256 newMaxNumberOfValidators
    ) external override onlyOwner {
        maxNumberOfValidators = newMaxNumberOfValidators;

        emit MaxNumberOfValidatorsUpdated(newMaxNumberOfValidators);
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
    function updateEpochRewardAmount(uint256 newEpochRewardAmount) external override onlyOwner {
        createEpochs();
        epochRewardAmount = newEpochRewardAmount;

        emit EpochRewardAmountUpdated(newEpochRewardAmount);
    }

    /**
     * @notice Update the validation period
     *
     * @param newValidationPeriod                new validation period
     */
    function updateValidationPeriod(uint256 newValidationPeriod) external onlyOwner {
        validationPeriod = newValidationPeriod;

        emit ValidationPeriodUpdated(newValidationPeriod);
    }

    /**
     * @notice Update the validatorScoreMinTrust
     *
     * @param newValidatorScoreMinTrust                new validatorScoreMinTrust
     */
    function updateValidatorScoreMinTrust(uint256 newValidatorScoreMinTrust) external onlyOwner {
        validatorScoreMinTrust = newValidatorScoreMinTrust;

        emit ValidatorScoreMinTrustUpdated(newValidatorScoreMinTrust);
    }

    /**
     * @notice Update the validatorScoreKappa
     *
     * @param newValidatorScoreKappa                new validatorScoreKappa
     */
    function updateValidatorScoreKappa(uint256 newValidatorScoreKappa) external onlyOwner {
        validatorScoreKappa = newValidatorScoreKappa;

        emit ValidatorScoreKappaUpdated(newValidatorScoreKappa);
    }

    /**
     * @notice Update the validatorScoreRho
     *
     * @param newValidatorScoreRho                new validatorScoreRho
     */
    function updateValidatorScoreRho(uint256 newValidatorScoreRho) external onlyOwner {
        validatorScoreRho = newValidatorScoreRho;

        emit ValidatorScoreRhoUpdated(newValidatorScoreRho);
    }

    /**
     * @notice Register a validator
     *
     * @param validatorAddress                         address of the validator
     * @param validatorOwnerAddress              owner of the validator
     */
    function registerValidator(
        address validatorAddress,
        address payable validatorOwnerAddress
    ) external payable override whenNotPaused {
        if (_validatorInfo[validatorAddress].status != ValidatorStatus.None) {
            revert ValidatorAlreadyRegistered();
        }

        if (msg.value < minStakeAmount) {
            revert InvalidStakeAmount();
        }

        _validatorInfo[validatorAddress].ownerAddress = validatorOwnerAddress;
        _validatorInfo[validatorAddress].stakeAmount = msg.value;
        _validatorInfo[validatorAddress].status = ValidatorStatus.Registered;

        _validators.add(validatorAddress);

        emit ValidatorRegistered(validatorAddress, validatorOwnerAddress, msg.value);
    }

    function approveValidator(
        address  validatorAddress
    ) public onlyOwner {
        createEpochs();
        uint256 index;

        EnumerableSet.AddressSet
            storage activeValidatorsList = _activeValidatorsLists[
                activeValidatorsListsCount
            ];
        uint256 activeValidatorsListCount = activeValidatorsList.length();

        activeValidatorsListsCount++;

        EnumerableSet.AddressSet
            storage newActiveValidatorsList = _activeValidatorsLists[
                activeValidatorsListsCount
            ];

        for (index = 0; index < activeValidatorsListCount; index++) {
            newActiveValidatorsList.add(activeValidatorsList.at(index));
        }

        if(_validatorInfo[validatorAddress].status != ValidatorStatus.Registered) {
            revert ValidatorNotRegistered();
        }
        newActiveValidatorsList.add(validatorAddress);
        _validatorsWithFilesToVerify.add(validatorAddress);

        _validatorInfo[validatorAddress].status = ValidatorStatus
            .Active;

        _epochs[epochsCount].validatorsListId = activeValidatorsListsCount;

        if(addingFilePaused) {
            addingFilePaused = false;
        }

        emit ValidatorApproved(validatorAddress);
    }

     /**
      * @notice Approve validator
      *
      * @param validatorAddress                        validator addresses
      */
     function deregisterValidator(
         address validatorAddress
     ) external onlyValidatorOwnerAddress(msg.sender) {
         createEpochs();

         if(_validatorInfo[validatorAddress].status != ValidatorStatus.Registered) {
             revert ValidatorNotRegistered();
         }

         createEpochs();
         uint256 index;

         EnumerableSet.AddressSet
         storage activeValidatorsList = _activeValidatorsLists[
                     activeValidatorsListsCount
             ];
         uint256 activeValidatorsListCount = activeValidatorsList.length();

         activeValidatorsListsCount++;

         EnumerableSet.AddressSet
         storage newActiveValidatorsList = _activeValidatorsLists[
                     activeValidatorsListsCount
             ];

         for (index = 0; index < activeValidatorsListCount; index++) {
             if(activeValidatorsList.at(index) != validatorAddress) {
                newActiveValidatorsList.add(activeValidatorsList.at(index));
             }
         }

         ValidatorInfo storage validator = _validatorInfo[validatorAddress];

         if(validator.filesToVerifyCount == validator.filesToVerifyIndex) {
            _validatorsWithFilesToVerify.remove(validatorAddress);
         }

         _validatorInfo[validatorAddress].status = ValidatorStatus
             .Deregistered;

         _epochs[epochsCount].validatorsListId = activeValidatorsListsCount;

         if(activeValidatorsListCount == 1) {
             addingFilePaused = true;
         }

        emit ValidatorDeregistered(validatorAddress);
     }

    /**
     * @notice Set the master key
     *
     * @param newMasterKey                       new master key
     */
    function setMasterKey(
        string memory newMasterKey
    ) external onlyActiveValidators {
        if (bytes(masterKey).length != 0) {
            revert MasterKeyAlreadySet();
        }
        masterKey = newMasterKey;

        emit MasterKeySet(newMasterKey);
    }

    /**
     * @notice Add a file to the pool
     *
     * @param url                                    file url
     * @param encryptedKey                           encrypted key
     */
    function addFile(string memory url, string memory encryptedKey) external whenNotPaused whenAddingFileNotPaused {
        createEpochs();
        bytes32 urlHash = keccak256(abi.encodePacked(url));
        if (_fileUrlHases.contains(urlHash)) {
            revert FileAlreadyAdded();
        }

        _fileUrlHases.add(urlHash);
        uint256 filesId = _fileUrlHases.length();

        File storage file = _files[filesId];

        file.ownerAddress = msg.sender;
        file.url = url;
        file.encryptedKey = encryptedKey;
        file.addedTimestamp = block.timestamp;

        uint256 epochValidatorsListId = _epochs[epochsCount].validatorsListId;

        uint256 epochValidatorsCount = _activeValidatorsLists[
            epochValidatorsListId
        ].length();

        address assignedValidator = _activeValidatorsLists[
            epochValidatorsListId
        ].at(filesId % epochValidatorsCount);

        ValidatorInfo storage validator = _validatorInfo[assignedValidator];
        validator.filesToVerifyCount++;
        validator.filesToVerify[validator.filesToVerifyCount] = filesId;

        emit FileAdded(msg.sender, filesId);
    }

    /**
     * @notice Verify a file
     *
     * @param fileId                              file id
     * @param score                               score of the verification
     * @param metadata                            metadata
     */
    function verifyFile(
        uint256 fileId,
        uint256 score,
        string memory metadata
    ) external onlyActiveValidators {
        createEpochs();

        if (_files[fileId].verificationsCount > 0) {
            revert FileAlreadyVerified();
        }

        NextFileToVerify memory nextFileToVerify = getNextFileToVerify(
            msg.sender
        );

        if (nextFileToVerify.fileId != fileId || fileId == 0) {
            revert InvalidFileId();
        }

        File storage file = _files[fileId];

        FileVerificationInfo storage verification = file.verifications[
            file.verificationsCount
        ];

        file.verificationsCount++;

        verification.validatorAddress = msg.sender;
        verification.timespatmp = block.timestamp;
        verification.score = score;
        verification.metadata = metadata;

        _validatorInfo[nextFileToVerify.assignedValidator].filesToVerifyIndex++;

        emit FileVerified(msg.sender, fileId, score);
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

            newEpoch.validatorsListId = lastEpoch.validatorsListId;
            newEpoch.startBlock = lastEpoch.endBlock + 1;
            newEpoch.endBlock = newEpoch.startBlock + epochSize - 1;
            newEpoch.reward = epochRewardAmount;

            lastEpoch = newEpoch;

            emit EpochCreated(epochCountTemp);
        }

        epochsCount = epochCountTemp;
    }

    /**
     * @notice Set the weights for the validators
     */
    function updateWeights(
        address[] memory validators,
        uint256[] memory weights
    ) external onlyActiveValidators {
        createEpochs();

        uint256 length = validators.length;

        if (length != weights.length) {
            revert ArityMismatch();
        }

        ValidatorInfo storage validator = _validatorInfo[msg.sender];

        for (uint256 i = 0; i < weights.length; i++) {
            validator.weights[validators[i]] = weights[i];
        }

        emit WeightsUpdated(msg.sender, validators, weights);
    }

    /**
     * @notice Add rewards to the pool
     */
    function addRewards() external payable {
        totalRewardAmount += msg.value;
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
    ) public pure returns (uint256) {
        // This will help us determine which version of the sigmoid function to use, to ensure we never use negative values
        bool aboveTrustThreshold = xWAD > kWAD;

        // ---- Calculate (x - k) * WAD ----
        // Start with xWAD and kWAD: x * WAD - k * WAD = (x - k) * WAD
        uint256 shiftWAD = aboveTrustThreshold ? xWAD - kWAD : kWAD - xWAD;

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
        if (aboveTrustThreshold) {
            return (aWAD * numeratorWAD) / denominatorWAD + aWAD;
        } else {
            return 1e18 - ((aWAD * numeratorWAD) / denominatorWAD + aWAD);
        }
    }

    /**
     * @notice Set the emission scores for the validators
     *
     * @param S                                   stake amounts
     */
    function _normalizeStakes(
        uint256[] memory S
    ) internal pure returns (uint256[] memory) {
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
    function _calculateTrust(
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
    ) internal pure returns (uint256[] memory) {
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
    function _calculateEmissions(
        uint256[] memory C,
        uint256[] memory R
    ) internal pure returns (uint256[] memory) {
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
     * @param epochNumber                   epoch number
     */
    function getEmissionScores(
        uint256 epochNumber
    ) public view returns (uint256[] memory) {
        EnumerableSet.AddressSet storage epochValidators = _activeValidatorsLists[
            _epochs[epochNumber].validatorsListId
        ];

        uint256 epochValidatorsCount = epochValidators.length();

        uint256[] memory S = new uint256[](epochValidatorsCount);

        bool hasAnyStake = false;
        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            S[i] = _validatorInfo[epochValidators.at(i)].stakeAmount;
            if (!hasAnyStake && S[i] > 0) {
                hasAnyStake = true;
            }
        }

        if (!hasAnyStake) {
            return new uint256[](0);
        }

        uint256[][] memory W = new uint256[][](epochValidatorsCount);
        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            W[i] = new uint256[](epochValidatorsCount);

            ValidatorInfo storage validator = _validatorInfo[
                epochValidators.at(i)
            ];

            for (uint256 j = 0; j < epochValidatorsCount; j++) {
                W[i][j] = validator.weights[epochValidators.at(j)];
            }
        }

        uint256[] memory normalizedStakes = _normalizeStakes(S);
        uint256[] memory T = _calculateTrust(W, normalizedStakes);
        uint256[] memory R = calculateRank(W, normalizedStakes);
        uint256[] memory C = calculateConsensus(T);
        return _calculateEmissions(C, R);
    }

    /**
     * @notice Set the emission scores for the validators
     *
     * @param epochNumber                   epoch number
     */
    function _setEmissionScores(uint256 epochNumber) internal {
        EnumerableSet.AddressSet storage epochValidators = _activeValidatorsLists[
            _epochs[epochNumber].validatorsListId
        ];

        uint256 epochValidatorsCount = epochValidators.length();

        uint256[] memory shares = getEmissionScores(epochNumber);

        Epoch storage epoch = _epochs[epochNumber];
        for (uint256 i = 0; i < epochValidatorsCount; i++) {
            address validatorAddress = epochValidators.at(i);
            uint256 validatorReward = (shares[i] * epoch.reward) / 1e18;

            uint256 validatorRewardDiff = validatorReward -
                epoch.validatorRewards[validatorAddress].withdrawnAmount;

            epoch.validatorRewards[validatorAddress].share = shares[i];
            epoch
                .validatorRewards[validatorAddress]
                .withdrawnAmount = validatorReward;

            //send the reward to the validator
            if (
                validatorRewardDiff > 0 &&
                totalRewardAmount > validatorRewardDiff
            ) totalRewardAmount -= validatorRewardDiff;
            _validatorInfo[validatorAddress].ownerAddress.transfer(
                validatorRewardDiff
            );
        }
    }
}
