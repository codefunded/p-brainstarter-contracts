// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC1967Proxy } from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import { ERC20Upgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import { ERC20BurnableUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol';
import { ERC20PermitUpgradeable } from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol';
import { OwnableUpgradeable } from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import { Initializable } from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import { UUPSUpgradeable } from '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import { DateTimeLib } from 'solady/src/utils/DateTimeLib.sol';

uint256 constant YEARS_WITH_ALLOWED_MINT = 5;

/**
 * Contract for the BRAINS token.
 */
contract Brains is
  Initializable,
  ERC20Upgradeable,
  ERC20BurnableUpgradeable,
  ERC20PermitUpgradeable,
  OwnableUpgradeable,
  UUPSUpgradeable
{
  /// @custom:storage-location erc7201:brains.main
  struct MainStorage {
    uint256 contractDeploymentTimestamp;
    uint256 yearlyMintLimit;
    mapping(uint256 => uint256) mintedInYear;
  }

  error Brains__BatchTransferArgsLengthMismatch();
  error Brains__MintPeriodEnded();
  error Brains__MintLimitExceeded(uint256 mintLimit, uint256 triedToMint, uint256 alreadyMintedInYear);

  // keccak256(abi.encode(uint256(keccak256('brains.main')) - 1)) & ~bytes32(uint256(0xff));
  bytes32 private constant MAIN_STORAGE_LOCATION = 0xabe2c6f19744d867ea22b9a7c2a8864c93576dec52f49e61303eebf176d22800;

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
    uint256 _yearlyMintLimit,
    string memory _name,
    string memory _symbol
  ) public initializer {
    __ERC20_init(_name, _symbol);
    __ERC20Burnable_init();
    __ERC20Permit_init(_name);
    __Ownable_init(_owner);
    __UUPSUpgradeable_init();

    MainStorage storage s = _getMainStorage();

    s.contractDeploymentTimestamp = block.timestamp;
    s.yearlyMintLimit = _yearlyMintLimit;

    _mint(_msgSender(), _initialSupply);
  }

  // ***************** PUBLIC FUNCTIONS *****************

  function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) public {
    require(recipients.length == amounts.length, Brains__BatchTransferArgsLengthMismatch());

    for (uint256 i = 0; i < recipients.length; i++) {
      transfer(recipients[i], amounts[i]);
    }
  }

  /**
   * This function allows the owner to mint new tokens but only for a limited time. In the project's
   * whitepaper, a period of 5 years is specified after which no more minting is allowed. Also, there's
   * a yearly limit for minting new tokens.
   * @param account to mint to
   * @param amount to mint
   */
  function mint(address account, uint256 amount) public onlyOwner {
    MainStorage storage s = _getMainStorage();

    require(
      block.timestamp < DateTimeLib.addYears(s.contractDeploymentTimestamp, YEARS_WITH_ALLOWED_MINT),
      Brains__MintPeriodEnded()
    );

    (uint currentYear, , ) = DateTimeLib.timestampToDate(block.timestamp);
    s.mintedInYear[currentYear] += amount;
    uint256 alreadyMintedInYear = s.mintedInYear[currentYear];

    require(
      alreadyMintedInYear <= s.yearlyMintLimit,
      Brains__MintLimitExceeded(s.yearlyMintLimit, amount, alreadyMintedInYear)
    );

    _mint(account, amount);
  }

  // ***************** INTERNAL FUNCTIONS *****************

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
