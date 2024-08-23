// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { EnumerableSet } from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import { ERC721Upgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol';
import { ERC721EnumerableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol';
import { ERC721PausableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol';
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
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
  UUPSUpgradeable
{
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant MANAGER_ROLE = keccak256('MANAGER_ROLE');
  bytes32 public constant UPGRADER_ROLE = keccak256('UPGRADER_ROLE');

  /// @custom:storage-location erc7201:brains.locked-stake
  struct LockedStakeStorage {
    EnumerableSet.AddressSet stakers;
  }

  // keccak256(abi.encode(uint256(keccak256('brains.locked-stake')) - 1)) & ~bytes32(uint256(0xff));
  bytes32 private constant MAIN_STORAGE_LOCATION = 0x6ef12029af7f259c18abf717f4a506459b223392ea42f31bae090def9b4a2600;

  function _getStorage() private pure returns (LockedStakeStorage storage $) {
    assembly {
      $.slot := MAIN_STORAGE_LOCATION
    }
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address defaultAdmin) public initializer {
    __ERC721_init('Brainstarter Locked Stake', 'BLS');
    __ERC721Enumerable_init();
    __AccessControl_init();
    __UUPSUpgradeable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
  }

  // ***************** EXTERNAL FUNCTIONS *****************

  function getStakersAmount() external view returns (uint256) {
    LockedStakeStorage storage s = _getStorage();
    return s.stakers.length();
  }

  function getStakerByIndex(uint256 index) external view returns (address) {
    LockedStakeStorage storage s = _getStorage();
    return s.stakers.at(index);
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

    address from = super._update(to, tokenId, auth);

    LockedStakeStorage storage s = _getStorage();
    if (from == address(0)) {
      s.stakers.add(to);
    }
    if (to == address(0)) {
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
