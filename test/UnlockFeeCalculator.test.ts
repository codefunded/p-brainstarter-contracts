import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import hre, { ethers } from 'hardhat';
import { expect } from 'chai';
import { deployBrains } from './helpers/deploy';
import { LockType } from './helpers/LockType';

describe('UnlockFeeCalculator', () => {
  describe('Seed', () => {
    it('Should not allow to withdraw at all for first 12 months', async () => {
      const { brains, brainsStaking } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('100'),
        LockType.Seed,
      );

      await expect(
        brainsStaking.connect(other).unstakeLocked(),
      ).to.be.revertedWithCustomError(
        brainsStaking,
        'UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory',
      );
      await expect(
        brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee(),
      ).to.be.revertedWithCustomError(
        brainsStaking,
        'UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory',
      );
      await time.increase(time.duration.days(13 * 30)); // 13 months to get the possibility to withdraw
      await expect(brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee()).to
        .not.be.reverted;
    });

    it('should allow to withdraw after 12 months but with a fee', async () => {
      const { brains, brainsStaking } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('100'),
        LockType.Seed,
      );

      await expect(
        brainsStaking.connect(other).unstakeLocked(),
      ).to.be.revertedWithCustomError(
        brainsStaking,
        'UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory',
      );
      await expect(
        brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee(),
      ).to.be.revertedWithCustomError(
        brainsStaking,
        'UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory',
      );
      await time.increase(time.duration.days(30 * 13));
      const beforeUnstakeStateSnapshotId = await hre.network.provider.request({
        method: 'evm_snapshot',
      });

      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      // first fee step for +M13 is 65%
      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('35'));

      await hre.network.provider.request({
        method: 'evm_revert',
        params: [beforeUnstakeStateSnapshotId],
      });
      const beforeUnstakeStateSnapshotId2 = await hre.network.provider.request({
        method: 'evm_snapshot',
      });

      await time.increase(time.duration.days(30));
      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      // fee step for +M14 is 60%
      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('40'));

      await hre.network.provider.request({
        method: 'evm_revert',
        params: [beforeUnstakeStateSnapshotId2],
      });

      await time.increase(time.duration.days(60));
      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      // fee step for +M15 is 55%
      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('45'));
    });

    it('should allow to withdraw after 25 months without the fee', async () => {
      const { brains, brainsStaking } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('100'),
        LockType.Seed,
      );
      const beforeUnstakeStateSnapshotId = await hre.network.provider.request({
        method: 'evm_snapshot',
      });

      await time.increase(time.duration.days(30 * 25));

      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      // fee for last step in M25 is 5%
      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('95'));

      await hre.network.provider.request({
        method: 'evm_revert',
        params: [beforeUnstakeStateSnapshotId],
      });

      await time.increase(time.duration.days(30 * 26));
      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      // fee for +M26 is 0%
      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('100'));
    });
  });

  describe('Strategic/Private', () => {
    it('Should not allow to withdraw at all for first 12 months', async () => {
      const { brains, brainsStaking } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('100'),
        LockType.StrategicOrPrivate,
      );

      await expect(
        brainsStaking.connect(other).unstakeLocked(),
      ).to.be.revertedWithCustomError(
        brainsStaking,
        'UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory',
      );
      await expect(
        brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee(),
      ).to.be.revertedWithCustomError(
        brainsStaking,
        'UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory',
      );
      await time.increase(time.duration.days(13 * 30)); // 13 months to get the possibility to withdraw
      await expect(brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee()).to
        .not.be.reverted;
    });

    it('should allow to withdraw after 12 months but with a fee', async () => {
      const { brains, brainsStaking } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('100'),
        LockType.StrategicOrPrivate,
      );

      await expect(
        brainsStaking.connect(other).unstakeLocked(),
      ).to.be.revertedWithCustomError(
        brainsStaking,
        'UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory',
      );
      await expect(
        brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee(),
      ).to.be.revertedWithCustomError(
        brainsStaking,
        'UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory',
      );
      await time.increase(time.duration.days(390));
      const beforeUnstakeStateSnapshotId = await hre.network.provider.request({
        method: 'evm_snapshot',
      });

      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      // first fee step for +M13 is 70%
      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('30'));

      await hre.network.provider.request({
        method: 'evm_revert',
        params: [beforeUnstakeStateSnapshotId],
      });
      const beforeUnstakeStateSnapshotId2 = await hre.network.provider.request({
        method: 'evm_snapshot',
      });

      await time.increase(time.duration.days(30));
      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      // fee step for +M14 is 65%
      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('35'));

      await hre.network.provider.request({
        method: 'evm_revert',
        params: [beforeUnstakeStateSnapshotId2],
      });

      await time.increase(time.duration.days(60));
      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      // fee step for +M15 is 60%
      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('40'));
    });
    it('should allow to withdraw after 25 months without the fee', async () => {
      const { brains, brainsStaking } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('100'),
        LockType.StrategicOrPrivate,
      );
      const beforeUnstakeStateSnapshotId = await hre.network.provider.request({
        method: 'evm_snapshot',
      });

      await time.increase(time.duration.days(30 * 24));

      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      // fee for last step in M24 is 15%
      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('85'));

      await hre.network.provider.request({
        method: 'evm_revert',
        params: [beforeUnstakeStateSnapshotId],
      });

      await time.increase(time.duration.days(30 * 25));
      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      // fee for +M25 is 0%
      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('100'));
    });
  });

  describe('PreSale', () => {
    for (const [month, feePercentage] of [
      [1, 85],
      [2, 85],
      [3, 80],
      [5, 80],
      [6, 75],
      [8, 75],
      [9, 70],
      [11, 70],
      [12, 65],
      [13, 60],
      [14, 55],
      [15, 50],
      [16, 45],
      [17, 40],
      [18, 35],
      [19, 30],
      [20, 25],
      [21, 20],
      [22, 15],
      [23, 10],
      [24, 5],
      [25, 0],
    ]) {
      it(`should allow to withdraw after ${month} months with ${feePercentage}% fee`, async () => {
        const { brains, brainsStaking } = await loadFixture(deployBrains);

        const [, other] = await ethers.getSigners();

        await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

        await brainsStaking.stakeFor(
          other.address,
          ethers.parseEther('100'),
          LockType.PreSale,
        );
        await time.increase(time.duration.days(30 * month));

        await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
        // fee for last step in M24 is 15%
        expect(await brains.balanceOf(other.address)).to.be.eq(
          ethers.parseEther('100') - ethers.parseEther(String(feePercentage)),
        );
      });
    }
    it('should allow to withdraw righ away but with a fee', async () => {
      const { brains, brainsStaking } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('100'),
        LockType.PreSale,
      );

      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      // fee for +M0 is 85%
      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('15'));
    });
  });
});
