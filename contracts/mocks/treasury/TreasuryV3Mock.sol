// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract TreasuryV3Mock is UUPSUpgradeable {
    uint256 test;

    function _authorizeUpgrade(address newImplementation) internal virtual override {}
}
