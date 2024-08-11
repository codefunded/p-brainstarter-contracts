// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ERC721Upgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol';
import { ERC721EnumerableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol';
import { ERC721PausableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol';
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import { ERC721BurnableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol';
import { Initializable } from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import { UUPSUpgradeable } from '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';

error LockedStake__StakeTransfersNotAllowed();

/**
 * This contract represents a locked stake, not transferable.
 */
contract LockedStake is
  Initializable,
  ERC721Upgradeable,
  ERC721EnumerableUpgradeable,
  AccessControlUpgradeable,
  ERC721BurnableUpgradeable,
  UUPSUpgradeable
{
  bytes32 public constant MANAGER_ROLE = keccak256('MANAGER_ROLE');
  bytes32 public constant UPGRADER_ROLE = keccak256('UPGRADER_ROLE');

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address defaultAdmin) public initializer {
    __ERC721_init('Brainstarter Locked Stake', 'BLS');
    __ERC721Enumerable_init();
    __AccessControl_init();
    __ERC721Burnable_init();
    __UUPSUpgradeable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
  }

  // ***************** PUBLIC FUNCTIONS *****************

  function safeMint(address to) public onlyRole(MANAGER_ROLE) returns (uint256) {
    uint256 tokenId = getTokenIdFromAddress(to);
    _safeMint(to, tokenId);
    return tokenId;
  }

  function burnById(uint256 tokenId) public onlyRole(MANAGER_ROLE) {
    _burn(tokenId);
  }

  /// @dev This override is required by Solidity.
  function supportsInterface(
    bytes4 interfaceId
  ) public view override(ERC721Upgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function getTokenIdFromAddress(address _owner) public pure returns (uint256) {
    return uint256(uint160(_owner));
  }

  // ***************** INTERNAL FUNCTIONS *****************

  function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

  // The following functions are overrides required by Solidity.

  function _update(
    address to,
    uint256 tokenId,
    address auth
  ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) returns (address) {
    require(auth == address(0), LockedStake__StakeTransfersNotAllowed());
    return super._update(to, tokenId, auth);
  }

  function _increaseBalance(
    address account,
    uint128 value
  ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
    super._increaseBalance(account, value);
  }
}
