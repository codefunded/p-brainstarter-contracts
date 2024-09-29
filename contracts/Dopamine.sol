// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';

/**
 * Dopamine token contract. It is not a financial asset, it is just a marker that will be used for
 * off chain computations. Only admin can mint, burn and transfer tokens.
 */
contract Dopamine is
  Initializable,
  ERC20Upgradeable,
  ERC20BurnableUpgradeable,
  OwnableUpgradeable,
  ERC20PermitUpgradeable,
  UUPSUpgradeable
{
  error Dopamine__RecipientsAndAmountsLengthMismatch();
  error Dopamine__OnlyAdminCanTransfer();

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __ERC20_init('$DOPAMINE', '$DOPAMINE');
    __ERC20Burnable_init();
    __Ownable_init(initialOwner);
    __ERC20Permit_init('$DOPAMINE');
    __UUPSUpgradeable_init();
  }

  // ***************** PUBLIC FUNCTIONS *****************

  function mint(address to, uint256 amount) public onlyOwner {
    _mint(to, amount);
  }

  function burnByAdmin(address account, uint256 amount) public onlyOwner {
    _burn(account, amount);
  }

  function batchTransfer(address[] memory recipients, uint256[] memory amounts) public onlyOwner {
    require(recipients.length == amounts.length, Dopamine__RecipientsAndAmountsLengthMismatch());

    for (uint256 i = 0; i < recipients.length; i++) {
      _transfer(_msgSender(), recipients[i], amounts[i]);
    }
  }

  // ***************** INTERNAL FUNCTIONS *****************

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function _update(address from, address to, uint256 value) internal override {
    require(from == address(0) || to == address(0) || from == owner(), Dopamine__OnlyAdminCanTransfer());
    super._update(from, to, value);
  }
}
