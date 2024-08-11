// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { DateTimeLib } from 'solady/src/utils/DateTimeLib.sol';

enum LockType {
  Public,
  PreSale,
  StrategicOrPrivate,
  Seed,
  Founder
}

uint8 constant DAYS_IN_MONTH = 30;
uint8 constant YEAR_IN_MONTHS = 12;
uint8 constant TWO_YEARS_IN_MONTHS = 24;
uint8 constant FOUNDER_FLAT_FEE_PERCENTAGE = 90;

/**
 * Library for calculating unlock fees based on the lock type and the time passed since the staking.
 * Implements the table of fees from the whitepaper.
 */
library UnlockFeeCalculator {
  error UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory();

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
    uint256 monthsDifference = DateTimeLib.diffDays(stakedAt, block.timestamp) /
      DAYS_IN_MONTH;
    if (lockType == LockType.Public) {
      return 0; // no unlock fee
    }

    if (lockType == LockType.PreSale) {
      uint8[26] memory PRESALE_PERCENTAGE_PENALTY_TABLE = [
        85,
        85,
        85,
        80,
        80,
        80,
        75,
        75,
        75,
        70,
        70,
        70,
        65,
        60,
        55,
        50,
        45,
        40,
        35,
        30,
        25,
        20,
        15,
        10,
        5,
        0
      ];

      if (monthsDifference >= PRESALE_PERCENTAGE_PENALTY_TABLE.length) {
        return 0;
      }
      return (stakedAmount * PRESALE_PERCENTAGE_PENALTY_TABLE[monthsDifference]) / 100;
    }

    if (lockType == LockType.StrategicOrPrivate) {
      uint8[26] memory STRATEGIC_OR_PRIVATE_SALE_PERCENTAGE_PENALTY_TABLE = [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        70,
        65,
        60,
        55,
        50,
        45,
        40,
        35,
        30,
        25,
        20,
        15,
        0
      ];

      if (monthsDifference <= YEAR_IN_MONTHS) {
        revert UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory();
      }
      if (monthsDifference >= STRATEGIC_OR_PRIVATE_SALE_PERCENTAGE_PENALTY_TABLE.length) {
        return 0;
      }

      return
        (stakedAmount *
          STRATEGIC_OR_PRIVATE_SALE_PERCENTAGE_PENALTY_TABLE[monthsDifference]) / 100;
    }

    if (lockType == LockType.Seed) {
      uint8[26] memory SEED_SALE_PERCENTAGE_PENALTY_TABLE = [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        65,
        60,
        55,
        50,
        45,
        40,
        35,
        30,
        25,
        20,
        15,
        10,
        5
      ];
      if (monthsDifference <= YEAR_IN_MONTHS) {
        revert UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory();
      }
      if (monthsDifference >= SEED_SALE_PERCENTAGE_PENALTY_TABLE.length) {
        return 0;
      }
      return (stakedAmount * SEED_SALE_PERCENTAGE_PENALTY_TABLE[monthsDifference]) / 100;
    }

    if (lockType == LockType.Founder) {
      if (monthsDifference <= TWO_YEARS_IN_MONTHS) {
        revert UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory();
      }
      return (stakedAmount * FOUNDER_FLAT_FEE_PERCENTAGE) / 100;
    }

    return 0;
  }
}
