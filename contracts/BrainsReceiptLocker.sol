// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { UnlockFeeCalculator, LockType } from './UnlockFeeCalculator.sol';
import { IERC20, SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import { OwnableUpgradeable } from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import { Initializable } from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import { UUPSUpgradeable } from '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import { BrainsStaking } from './BrainsStaking.sol';

/**
 * This contract is responsible for exchanging the receipt tokens from pre-sale, strategic and seed sales
 * to actual $BRAINS token and locking it on staking right away depending on the sale type.
 * @dev IMPORTANT: the $BRAINS token must be present in the contract before calling the exchangeTokensAndStake function.
 * It is the responsibility of the inital admin to send enough $BRAINS tokens to this contract.
 */
contract BrainsReceiptLocker is Initializable, OwnableUpgradeable, UUPSUpgradeable {
  error BrainsReceiptLocker__InvalidToken();

  event TokensExchangedAndStaked(
    address indexed user,
    uint256 amount,
    address token,
    LockType lockType
  );

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /// @custom:storage-location erc7201:brains.receipt-locker
  struct StakingStorage {
    BrainsStaking staking;
    IERC20 underlyingToken;
    IERC20 preSaleToken;
    IERC20 strategicPrivateSaleToken;
    IERC20 seedToken;
  }

  // keccak256(abi.encode(uint256(keccak256('brains.receipt-locker')) - 1)) & ~bytes32(uint256(0xff));
  bytes32 private constant MAIN_STORAGE_LOCATION =
    0xfafe5bb59d255e97b74bfe8f1417e10c824eb8832226911847427da8b1cbd400;

  function _getStorage() private pure returns (StakingStorage storage $) {
    assembly {
      $.slot := MAIN_STORAGE_LOCATION
    }
  }

  function initialize(
    address _owner,
    BrainsStaking _staking,
    IERC20 _underlyingToken,
    IERC20 _preSaleToken,
    IERC20 _strategicPrivateSaleToken,
    IERC20 _seedToken
  ) public initializer {
    __Ownable_init(_owner);
    __UUPSUpgradeable_init();

    StakingStorage storage s = _getStorage();
    s.staking = _staking;
    s.underlyingToken = _underlyingToken;
    s.preSaleToken = _preSaleToken;
    s.strategicPrivateSaleToken = _strategicPrivateSaleToken;
    s.seedToken = _seedToken;
  }

  /**
   * Exchange the receipt token to $BRAINS token and stake it right away.
   * @param _amount The amount of tokens to exchange and stake
   * @param _token The token to exchange and stake
   */
  function exchangeTokensAndStake(uint256 _amount, IERC20 _token) public {
    StakingStorage storage s = _getStorage();
    require(
      _token == s.preSaleToken ||
        _token == s.strategicPrivateSaleToken ||
        _token == s.seedToken,
      BrainsReceiptLocker__InvalidToken()
    );
    SafeERC20.safeTransferFrom(_token, _msgSender(), address(this), _amount);

    LockType lockType = _token == s.preSaleToken
      ? LockType.PreSale
      : _token == s.strategicPrivateSaleToken
      ? LockType.StrategicOrPrivate
      : LockType.Seed;

    s.underlyingToken.approve(address(s.staking), _amount);
    s.staking.stakeFor(_msgSender(), _amount, lockType);

    emit TokensExchangedAndStaked(_msgSender(), _amount, address(_token), lockType);
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal virtual override onlyOwner {}
}
