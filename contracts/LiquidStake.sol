// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { EnumerableMap } from '@openzeppelin/contracts/utils/structs/EnumerableMap.sol';
import { EnumerableSet } from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import { ERC721Upgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol';
import { ERC721EnumerableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol';
import { ERC721PausableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol';
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
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
  UUPSUpgradeable
{
  using EnumerableMap for EnumerableMap.UintToUintMap;
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant MANAGER_ROLE = keccak256('MANAGER_ROLE');
  bytes32 public constant UPGRADER_ROLE = keccak256('UPGRADER_ROLE');
  uint256 private _nextTokenId;

  /// @custom:storage-location erc7201:brains.liquid-stake
  struct LiquidStakeStorage {
    EnumerableSet.AddressSet stakers;
  }

  // keccak256(abi.encode(uint256(keccak256('brains.liquid-stake')) - 1)) & ~bytes32(uint256(0xff));
  bytes32 private constant MAIN_STORAGE_LOCATION = 0x32c44090fcfc060c319940c94e6a6e4f830a70990f9414ba4fa8cddd3b3b2e00;

  function _getStorage() private pure returns (LiquidStakeStorage storage $) {
    assembly {
      $.slot := MAIN_STORAGE_LOCATION
    }
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address defaultAdmin) public initializer {
    __ERC721_init('Liquid $BRAINS Stake', 'LBS');
    __ERC721Enumerable_init();
    __AccessControl_init();
    __UUPSUpgradeable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
  }

  // ***************** EXTERNAL FUNCTIONS *****************

  function getStakersAmount() external view returns (uint256) {
    LiquidStakeStorage storage s = _getStorage();
    return s.stakers.length();
  }

  function getStakerByIndex(uint256 index) external view returns (address) {
    LiquidStakeStorage storage s = _getStorage();
    return s.stakers.at(index);
  }

  // ***************** PUBLIC FUNCTIONS *****************

  function safeMint(address to) public onlyRole(MANAGER_ROLE) returns (uint256) {
    uint256 tokenId = _nextTokenId++;
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

  // ***************** INTERNAL FUNCTIONS *****************

  function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

  // The following functions are overrides required by Solidity.

  function _update(
    address to,
    uint256 tokenId,
    address auth
  ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) returns (address) {
    address from = super._update(to, tokenId, auth);
    LiquidStakeStorage storage s = _getStorage();

    if (to == address(0)) {
      s.stakers.add(to);
    }
    if (from == address(0)) {
      s.stakers.remove(from);
    }

    return from;
  }

  function _increaseBalance(
    address account,
    uint128 value
  ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
    super._increaseBalance(account, value);
  }
}
