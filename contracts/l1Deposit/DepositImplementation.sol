// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {IDeposit} from "./interfaces/IDeposit.sol";
import {ERC165} from "./interfaces/ERC165.sol";

// This is a rewrite of the Eth2.0 deposit contract in Solidity.
contract DepositImplementation is UUPSUpgradeable, Ownable2StepUpgradeable, IDeposit, ERC165 {
    uint constant DEPOSIT_CONTRACT_TREE_DEPTH = 32;
    // NOTE: this also ensures `deposit_count` will fit into 64-bits
    uint constant MAX_DEPOSIT_COUNT = 2 ** DEPOSIT_CONTRACT_TREE_DEPTH - 1;

    bytes32[DEPOSIT_CONTRACT_TREE_DEPTH] branch;
    uint256 deposit_count;

    bytes32[DEPOSIT_CONTRACT_TREE_DEPTH] zero_hashes;

    bool public restricted;
    uint256 public minDepositAmount;
    uint256 public maxDepositAmount;

    struct Validator {
        bool isAllowed;
        bool hasDeposit;
    }

    mapping(bytes pubkey => Validator validator) public validators;

    event MinDepositAmountUpdated(uint256 newMinDepositAmount);
    event MaxDepositAmountUpdated(uint256 newMaxDepositAmount);
    event RestrictedUpdated(bool newRestricted);
    event AllowedValidatorsAdded(bytes validatorPublicKey);
    event AllowedValidatorsRemoved(bytes validatorPublicKey);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address ownerAddress,
        uint256 _minDepositAmount,
        uint256 _maxDepositAmount,
        bytes[] memory allowedValidators
    ) external initializer {
        __Ownable2Step_init();
        __UUPSUpgradeable_init();

        // Compute hashes in empty sparse Merkle tree
        for (uint height = 0; height < DEPOSIT_CONTRACT_TREE_DEPTH - 1; height++)
            zero_hashes[height + 1] = sha256(abi.encodePacked(zero_hashes[height], zero_hashes[height]));

        minDepositAmount = _minDepositAmount;
        maxDepositAmount = _maxDepositAmount;

        for (uint i = 0; i < allowedValidators.length; ++i) {
            validators[allowedValidators[i]].isAllowed = true;
        }

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
     * @notice Updates the minDepositAmount
     *
     * @param newMinDepositAmount                  new minDepositAmount
     */
    function updateMinDepositAmount(uint256 newMinDepositAmount) external onlyOwner {
        minDepositAmount = newMinDepositAmount;

        emit MinDepositAmountUpdated(newMinDepositAmount);
    }

    /**
     * @notice Updates the maxDepositAmount
     *
     * @param newMaxDepositAmount                  new maxDepositAmount
     */
    function updateMaxDepositAmount(uint256 newMaxDepositAmount) external onlyOwner {
        maxDepositAmount = newMaxDepositAmount;

        emit MaxDepositAmountUpdated(newMaxDepositAmount);
    }

    /**
     * @notice Updates the restricted
     *
     * @param _restricted                  new restricted
     */
    function updateRestricted(bool _restricted) external onlyOwner {
        restricted = _restricted;

        emit RestrictedUpdated(_restricted);
    }

    function addAllowedValidators(bytes[] memory validatorPublicKeys) external onlyOwner {
        for (uint i = 0; i < validatorPublicKeys.length; ++i) {
            validators[validatorPublicKeys[i]].isAllowed = true;

            emit AllowedValidatorsAdded(validatorPublicKeys[i]);
        }
    }

    function removeAllowedValidators(bytes[] memory validatorPublicKeys) external onlyOwner {
        for (uint i = 0; i < validatorPublicKeys.length; ++i) {
            validators[validatorPublicKeys[i]].isAllowed = false;

            emit AllowedValidatorsRemoved(validatorPublicKeys[i]);
        }
    }

    /**
     * @notice identical with the original deposit contract from Ethereum 2.0
     */
    function get_deposit_root() external view override returns (bytes32) {
        bytes32 node;
        uint size = deposit_count;
        for (uint height = 0; height < DEPOSIT_CONTRACT_TREE_DEPTH; height++) {
            if ((size & 1) == 1) node = sha256(abi.encodePacked(branch[height], node));
            else node = sha256(abi.encodePacked(node, zero_hashes[height]));
            size /= 2;
        }
        return sha256(abi.encodePacked(node, to_little_endian_64(uint64(deposit_count)), bytes24(0)));
    }

    /**
     * @notice identical with the original deposit contract from Ethereum 2.0
     */
    function get_deposit_count() external view override returns (bytes memory) {
        return to_little_endian_64(uint64(deposit_count));
    }

    /**
     * @notice similar to the original deposit contract from Ethereum 2.0
     * the only difference is the restriction of the validators
     */
    function deposit(
        bytes calldata pubkey,
        bytes calldata withdrawal_credentials,
        bytes calldata signature,
        bytes32 deposit_data_root
    ) external payable override {
        //only used for Vana phase1
        if (restricted) {
            require(validators[pubkey].isAllowed, "DepositContract: publicKey not allowed");
            require(!validators[pubkey].hasDeposit, "DepositContract: publickey already used");
        }

        validators[pubkey].hasDeposit = true;

        // Extended ABI length checks since dynamic types are used.
        require(pubkey.length == 48, "DepositContract: invalid pubkey length");
        require(withdrawal_credentials.length == 32, "DepositContract: invalid withdrawal_credentials length");
        require(signature.length == 96, "DepositContract: invalid signature length");

        // Check deposit amount
        require(msg.value >= minDepositAmount, "DepositContract: deposit value too low");
        require(msg.value % 1 gwei == 0, "DepositContract: deposit value not multiple of gwei");
        uint deposit_amount = msg.value / 1 gwei;
        require(msg.value <= maxDepositAmount, "DepositContract: deposit value too high");

        // Emit `DepositEvent` log
        bytes memory amount = to_little_endian_64(uint64(deposit_amount));
        emit DepositEvent(
            pubkey,
            withdrawal_credentials,
            amount,
            signature,
            to_little_endian_64(uint64(deposit_count))
        );

        // Compute deposit data root (`DepositData` hash tree root)
        bytes32 pubkey_root = sha256(abi.encodePacked(pubkey, bytes16(0)));
        bytes32 signature_root = sha256(
            abi.encodePacked(
                sha256(abi.encodePacked(signature[:64])),
                sha256(abi.encodePacked(signature[64:], bytes32(0)))
            )
        );
        bytes32 node = sha256(
            abi.encodePacked(
                sha256(abi.encodePacked(pubkey_root, withdrawal_credentials)),
                sha256(abi.encodePacked(amount, bytes24(0), signature_root))
            )
        );

        // Verify computed and expected deposit data roots match
        require(
            node == deposit_data_root,
            "DepositContract: reconstructed DepositData does not match supplied deposit_data_root"
        );

        // Avoid overflowing the Merkle tree (and prevent edge case in computing `branch`)
        require(deposit_count < MAX_DEPOSIT_COUNT, "DepositContract: merkle tree full");

        // Add deposit data root to Merkle tree (update a single `branch` node)
        deposit_count += 1;
        uint size = deposit_count;
        for (uint height = 0; height < DEPOSIT_CONTRACT_TREE_DEPTH; height++) {
            if ((size & 1) == 1) {
                branch[height] = node;
                return;
            }
            node = sha256(abi.encodePacked(branch[height], node));
            size /= 2;
        }
        // As the loop should always end prematurely with the `return` statement,
        // this code should be unreachable. We assert `false` just to be safe.
        assert(false);
    }

    /**
     * @notice identical with the original deposit contract from Ethereum 2.0
     */
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(ERC165).interfaceId || interfaceId == type(IDeposit).interfaceId;
    }

    /**
     * @notice identical with the original deposit contract from Ethereum 2.0
     */
    function to_little_endian_64(uint64 value) internal pure returns (bytes memory ret) {
        ret = new bytes(8);
        bytes8 bytesValue = bytes8(value);
        // Byteswapping during copying to bytes.
        ret[0] = bytesValue[7];
        ret[1] = bytesValue[6];
        ret[2] = bytesValue[5];
        ret[3] = bytesValue[4];
        ret[4] = bytesValue[3];
        ret[5] = bytesValue[2];
        ret[6] = bytesValue[1];
        ret[7] = bytesValue[0];
    }
}
