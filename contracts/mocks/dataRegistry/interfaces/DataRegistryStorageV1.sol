// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./IDataRegistry.sol";

/**
 * @title Storage for DataRegistry
 * @notice For future upgrades, do not change DataRegistryStorageV1. Create a new
 * contract which implements DataRegistryStorageV1
 */
abstract contract DataRegistryStorageV1 is IDataRegistry {
    uint256 public override filesCount;
    mapping(uint256 fileId => File) internal _files;
}
