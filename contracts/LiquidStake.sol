// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { EnumerableMap } from '@openzeppelin/contracts/utils/structs/EnumerableMap.sol';
import { ERC721Upgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol';
import { ERC721EnumerableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol';
import { ERC721PausableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol';
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import { ERC721BurnableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol';
import { Initializable } from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import { UUPSUpgradeable } from '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';

/**
 * This contract represents a stake which is liquid. It can be transferred and traded.
 */
contract LiquidStake is
  Initializable,
  ERC721Upgradeable,
  ERC721EnumerableUpgradeable,
  AccessControlUpgradeable,
  ERC721BurnableUpgradeable,
  UUPSUpgradeable
{
  using EnumerableMap for EnumerableMap.UintToUintMap;

  bytes32 public constant MANAGER_ROLE = keccak256('MANAGER_ROLE');
  uint256 private _nextTokenId;
  bytes32 public constant UPGRADER_ROLE = keccak256('UPGRADER_ROLE');

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address defaultAdmin) public initializer {
    __ERC721_init('Liquid $BRAINS Stake', 'LBS');
    __ERC721Enumerable_init();
    __AccessControl_init();
    __ERC721Burnable_init();
    __UUPSUpgradeable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
  }

  function safeMint(address to) public onlyRole(MANAGER_ROLE) returns (uint256) {
    uint256 tokenId = _nextTokenId++;
    _safeMint(to, tokenId);
    return tokenId;
  }

  function burnById(uint256 tokenId) public onlyRole(MANAGER_ROLE) {
    _burn(tokenId);
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyRole(UPGRADER_ROLE) {}

  // The following functions are overrides required by Solidity.

  function _update(
    address to,
    uint256 tokenId,
    address auth
  ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) returns (address) {
    return super._update(to, tokenId, auth);
  }

  function _increaseBalance(
    address account,
    uint128 value
  ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
    super._increaseBalance(account, value);
  }

  function supportsInterface(
    bytes4 interfaceId
  )
    public
    view
    override(ERC721Upgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable)
    returns (bool)
  {
    return super.supportsInterface(interfaceId);
  }
}
