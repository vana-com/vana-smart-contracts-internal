// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/IAccessControl.sol";

interface ITreasury is IAccessControl {
    function version() external pure returns (uint256);
    function withdraw(address _token, address _to, uint256 _amount) external returns (bool success);
}
