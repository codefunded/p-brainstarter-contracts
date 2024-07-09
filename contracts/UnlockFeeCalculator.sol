// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { DateTimeLib } from 'solady/src/utils/DateTimeLib.sol';
import 'hardhat/console.sol';

/**
 * Library for calculating unlock fees based on the lock type and the time passed since the staking.
 */
library UnlockFeeCalculator {
  error UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory();

  enum LockType {
    Public,
    PreSale,
    StrategicOrPrivate,
    Seed,
    Founder
  }

  /**
   * Get the unlock fee amount based on the lock type and the time passed since the staking.
   * @param lockType lock type of the staking
   * @param stakedAmount amount of tokens staked
   * @param stakedAt timestamp when the staking was made
   */
  function getUnlockFeeAmount(
    LockType lockType,
    uint256 stakedAmount,
    uint256 stakedAt
  ) internal view returns (uint256) {
    uint256 monthsDifference = DateTimeLib.diffDays(stakedAt, block.timestamp) / 30;
    if (lockType == LockType.Public) {
      return 0; // no unlock fee
    }

    if (lockType == LockType.PreSale) {
      if (monthsDifference <= 2) {
        return (stakedAmount * 85) / 100;
      }
      if (monthsDifference <= 5) {
        return (stakedAmount * 80) / 100;
      }
      if (monthsDifference <= 8) {
        return (stakedAmount * 75) / 100;
      }
      if (monthsDifference < 12) {
        return (stakedAmount * 70) / 100;
      }
      if (monthsDifference >= 25) {
        return 0;
      }

      uint monthsWith5PercentFeeDropdown = monthsDifference - 12;

      uint256 slashedPercent = 65 - (5 * monthsWith5PercentFeeDropdown);
      return (stakedAmount * slashedPercent) / 100;
    }

    if (lockType == LockType.StrategicOrPrivate) {
      if (monthsDifference < 13) {
        revert UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory();
      }
      if (monthsDifference >= 25) {
        return 0;
      }

      uint256 monthsWith5PercentFeeDropdown = monthsDifference - 13;
      uint256 slashedPercent = 70 - (5 * monthsWith5PercentFeeDropdown);
      return (stakedAmount * slashedPercent) / 100;
    }

    if (lockType == LockType.Seed) {
      if (monthsDifference < 13) {
        revert UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory();
      }
      if (monthsDifference >= 26) {
        return 0;
      }
      uint monthsWith5PercentFeeDropdown = monthsDifference - 13;

      uint256 slashedPercent = 65 - (5 * monthsWith5PercentFeeDropdown);
      return (stakedAmount * slashedPercent) / 100;
    }

    if (lockType == LockType.Founder) {
      if (monthsDifference <= 24) {
        revert UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory();
      }
      return (stakedAmount * 90) / 100;
    }

    return 0;
  }
}
