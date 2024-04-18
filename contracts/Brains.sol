// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import { ERC1967Proxy } from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import { ERC20Upgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import { ERC20BurnableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol';
import { ERC20PermitUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol';
import { OwnableUpgradeable } from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import { Initializable } from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import { UUPSUpgradeable } from '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import { DateTimeLib } from 'solady/src/utils/DateTimeLib.sol';

error Brains__BatchTransferArgsLengthMismatch();
error Brains__MintPeriodEnded();
error Brains__MintLimitExceeded(
  uint256 mintLimit,
  uint256 triedToMint,
  uint256 alreadyMintedInYear
);

contract Brains is
  Initializable,
  ERC20Upgradeable,
  ERC20BurnableUpgradeable,
  ERC20PermitUpgradeable,
  OwnableUpgradeable,
  UUPSUpgradeable
{
  uint256 private constant YEARS_WITH_ALLOWED_MINT = 5;

  /// @custom:storage-location erc7201:brains.main
  struct MainStorage {
    uint256 contractDeploymentTimestamp;
    uint256 yearlyMintLimit;
    mapping(uint256 => uint256) mintedInYear;
  }

  // keccak256(abi.encode(uint256(keccak256('brains.main')) - 1)) & ~bytes32(uint256(0xff));
  bytes32 private constant MAIN_STORAGE_LOCATION =
    0xabe2c6f19744d867ea22b9a7c2a8864c93576dec52f49e61303eebf176d22800;

  function _getMainStorage() private pure returns (MainStorage storage $) {
    assembly {
      $.slot := MAIN_STORAGE_LOCATION
    }
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address _owner,
    uint256 _initialSupply,
    uint256 _yearlyMintLimit
  ) public initializer {
    __ERC20_init('Brains', 'BRAINS');
    __ERC20Burnable_init();
    __ERC20Permit_init('Brains');
    __Ownable_init(_owner);
    __UUPSUpgradeable_init();

    MainStorage storage s = _getMainStorage();

    s.contractDeploymentTimestamp = block.timestamp;
    s.yearlyMintLimit = _yearlyMintLimit;

    _mint(_msgSender(), _initialSupply);
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function burn(uint256 amount) public override {
    _burn(_msgSender(), amount);
  }

  function batchTransfer(
    address[] calldata recipients,
    uint256[] calldata amounts
  ) public {
    if (recipients.length != amounts.length) {
      revert Brains__BatchTransferArgsLengthMismatch();
    }

    for (uint256 i = 0; i < recipients.length; i++) {
      transfer(recipients[i], amounts[i]);
    }
  }

  function mint(address account, uint256 amount) public onlyOwner {
    MainStorage storage s = _getMainStorage();

    if (
      DateTimeLib.addYears(s.contractDeploymentTimestamp, YEARS_WITH_ALLOWED_MINT) <
      block.timestamp
    ) {
      revert Brains__MintPeriodEnded();
    }

    (uint currentYear, , ) = DateTimeLib.timestampToDate(block.timestamp);
    s.mintedInYear[currentYear] += amount;
    uint256 alreadyMintedInYear = s.mintedInYear[currentYear];

    if (alreadyMintedInYear > s.yearlyMintLimit) {
      revert Brains__MintLimitExceeded(s.yearlyMintLimit, amount, alreadyMintedInYear);
    }

    _mint(account, amount);
  }
}
