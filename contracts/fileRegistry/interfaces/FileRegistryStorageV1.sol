// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./IFileRegistry.sol";

/**`
 * @title Storage for FileRegistry
 * @notice For future upgrades, do not change FileRegistryStorageV1. Create a new
 * contract which implements FileRegistryStorageV1
 */
abstract contract FileRegistryStorageV1 is IFileRegistry {
    uint256 public override filesCount;
    mapping(uint256 => File) public _files;
}
