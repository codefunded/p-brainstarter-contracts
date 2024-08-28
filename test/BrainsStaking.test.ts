import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployBrains } from './helpers/deploy';
import { LockType } from './helpers/LockType';

describe('BrainsStaking', function () {
  describe('locked stakes', () => {
    it('Should allow to stake tokens (even for other address)', async () => {
      const { brains, brainsStaking, lockedStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('100'), LockType.Public);
      const stakeId = await lockedStake.getTokenIdFromAddress(other.address);

      expect(await lockedStake.ownerOf(stakeId)).to.equal(other.address);
    });

    it('should allow to unstake tokens staked in locked type stake when no lock', async () => {
      const { brains, brainsStaking, lockedStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('100'), LockType.Public);
      const stakeId = await lockedStake.getTokenIdFromAddress(other.address);

      expect(await lockedStake.ownerOf(stakeId)).to.equal(other.address);

      await brainsStaking.connect(other).unstakeLocked();

      expect(await lockedStake.balanceOf(other.address)).to.equal(0);
    });

    for (const lockType of [LockType.StrategicOrPrivate, LockType.Seed, LockType.Founder]) {
      it(`should not allow to unstake tokens staked in locked type stake when invested in ${LockType[lockType]} round`, async () => {
        const { brains, brainsStaking, lockedStake } = await loadFixture(deployBrains);

        const [, other] = await ethers.getSigners();

        await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

        await brainsStaking.stakeFor(other.address, ethers.parseEther('100'), lockType);
        const stakeId = await lockedStake.getTokenIdFromAddress(other.address);

        expect(await lockedStake.ownerOf(stakeId)).to.equal(other.address);

        await expect(brainsStaking.connect(other).unstakeLocked()).to.be.revertedWithCustomError(
          brainsStaking,
          'UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory',
        );
      });
    }
    it(`should only allow to unstake tokens with fee when staked in lockedStake type stake and invested in ${LockType.PreSale} round`, async () => {
      const { brains, brainsStaking, lockedStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('100'), LockType.PreSale);
      const stakeId = await lockedStake.getTokenIdFromAddress(other.address);

      expect(await lockedStake.ownerOf(stakeId)).to.equal(other.address);

      await expect(brainsStaking.connect(other).unstakeLocked()).to.be.revertedWithCustomError(
        brainsStaking,
        'BrainsStaking__StakeNotMatured',
      );

      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();

      expect(await lockedStake.balanceOf(other.address)).to.equal(0);

      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('15'));
    });
  });

  describe('liquid stakes', () => {
    it('should allow to stake tokens when liquid threshold is set', async () => {
      const { brains, brainsStaking, liquidStake } = await loadFixture(deployBrains);

      const [, other, unlocker] = await ethers.getSigners();

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('100'), LockType.Public);
      const amountOfLiquidStakes = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakes).to.equal(1);
      const stakeId = await liquidStake.tokenOfOwnerByIndex(other.address, 0);

      await liquidStake.connect(other).transferFrom(other.address, unlocker.address, stakeId);

      expect(await liquidStake.ownerOf(stakeId)).to.equal(unlocker.address);

      await brainsStaking.connect(unlocker).unstakeLiquid(stakeId);

      expect(await liquidStake.balanceOf(unlocker.address)).to.equal(0);
      expect(await brains.balanceOf(unlocker.address)).to.be.eq(ethers.parseEther('100'));
    });

    it('if staked more than threshold, should also create locked stake with the remainder', async () => {
      const { brains, brainsStaking, liquidStake, lockedStake } = await loadFixture(deployBrains);

      const [, other, unlocker] = await ethers.getSigners();

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('150'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('150'), LockType.Public);
      const amountOfLiquidStakes = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakes).to.equal(1);
      const stakeId = await liquidStake.tokenOfOwnerByIndex(other.address, 0);

      await liquidStake.connect(other).transferFrom(other.address, unlocker.address, stakeId);

      expect(await liquidStake.ownerOf(stakeId)).to.equal(unlocker.address);

      await brainsStaking.connect(unlocker).unstakeLiquid(stakeId);

      expect(await liquidStake.balanceOf(unlocker.address)).to.equal(0);
      expect(await brains.balanceOf(unlocker.address)).to.be.eq(ethers.parseEther('100'));

      expect(await lockedStake.balanceOf(other.address)).to.equal(1);
      expect((await brainsStaking.getLockedStakeInfo(other.address)).amount).to.be.eq(ethers.parseEther('50'));
    });

    it('if staked less than threshold and adds a new stake still below threshold it should update the locked stake', async () => {
      const { brains, brainsStaking, liquidStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('50'));
      await brainsStaking.stakeFor(other.address, ethers.parseEther('50'), LockType.Public);

      const amountOfLiquidStakes = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakes).to.equal(0);

      expect(await liquidStake.balanceOf(other.address)).to.equal(0);
      expect((await brainsStaking.getLockedStakeInfo(other.address)).amount).to.be.eq(ethers.parseEther('50'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('30'));
      await brainsStaking.stakeFor(other.address, ethers.parseEther('30'), LockType.Public);

      expect(await liquidStake.balanceOf(other.address)).to.equal(0);
      expect((await brainsStaking.getLockedStakeInfo(other.address)).amount).to.be.eq(ethers.parseEther('80'));
    });

    it('when user already has existing locked stake and now stakes more than threshold, should create new liquid stakes and should keep the locked stake if there is remainder', async () => {
      const { brains, brainsStaking, liquidStake, lockedStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('150'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('150'), LockType.Public);
      const amountOfLiquidStakes = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakes).to.equal(1);
      expect(await lockedStake.balanceOf(other.address)).to.equal(1);
      expect((await brainsStaking.getLockedStakeInfo(other.address)).amount).to.be.eq(ethers.parseEther('50'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('60'));
      await brainsStaking.stakeFor(other.address, ethers.parseEther('60'), LockType.Public);
      const amountOfLiquidStakesAfterSecondStake = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakesAfterSecondStake).to.equal(2);
      expect((await brainsStaking.getLockedStakeInfo(other.address)).amount).to.be.eq(ethers.parseEther('10'));
    });
    it('when user already has existing locked stake and now stakes more than threshold, should create new liquid stakes and burn the locked stake if there is no remainder', async () => {
      const { brains, brainsStaking, liquidStake, lockedStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('150'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('150'), LockType.Public);
      const amountOfLiquidStakes = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakes).to.equal(1);

      expect(await lockedStake.balanceOf(other.address)).to.equal(1);
      expect((await brainsStaking.getLockedStakeInfo(other.address)).amount).to.be.eq(ethers.parseEther('50'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('50'));
      await brainsStaking.stakeFor(other.address, ethers.parseEther('50'), LockType.Public);
      const amountOfLiquidStakesAfterSecondStake = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakesAfterSecondStake).to.equal(2);
      expect(await lockedStake.balanceOf(other.address)).to.equal(0);
      expect((await brainsStaking.getLockedStakeInfo(other.address)).amount).to.be.eq(ethers.parseEther('0'));
    });
  });

  describe('admin fee withdrawal', () => {
    it('should correctly add fee when trying to unstake before maturity', async () => {
      const { brains, brainsStaking } = await loadFixture(deployBrains);

      const [, other, other2] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('200'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('100'), LockType.PreSale);
      await brainsStaking.stakeFor(other2.address, ethers.parseEther('100'), LockType.PreSale);

      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();
      await brainsStaking.connect(other2).unstakeLockedBeforeMaturedWithFee();

      const collectedFees = await brainsStaking.getCollectedFees();

      expect(collectedFees).to.be.eq(ethers.parseEther('85') * 2n);
    });
    it('should allow to withdraw admin fee', async () => {
      const { brains, brainsStaking } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('100'), LockType.PreSale);

      await brainsStaking.connect(other).unstakeLockedBeforeMaturedWithFee();

      const collectedFees = await brainsStaking.getCollectedFees();

      await expect(
        brainsStaking.withdrawTokens(await brains.getAddress(), collectedFees * 2n),
      ).to.be.revertedWithCustomError(brainsStaking, 'BrainsStaking__NotEnoughFeesCollected');

      await expect(
        brainsStaking.connect(other).withdrawTokens(await brains.getAddress(), collectedFees),
      ).to.be.revertedWithCustomError(brainsStaking, 'OwnableUnauthorizedAccount');

      await expect(brainsStaking.withdrawTokens(await brains.getAddress(), collectedFees)).to.not.be.reverted;

      expect(await brainsStaking.getCollectedFees()).to.be.eq(0n);
    });
  });

  describe('lock types stake', () => {
    it('should not allow to stake with different lock types when stake is under liquid threshold', async () => {
      const { brains, brainsStaking } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('90'), LockType.PreSale);

      await expect(
        brainsStaking.stakeFor(other.address, ethers.parseEther('10'), LockType.Public),
      ).to.be.revertedWithCustomError(brainsStaking, 'BrainsStaking__LockTypeMismatch');
    });

    it('should allow to stake up to liquid threshold with the same lock type and create an liquid stake', async () => {
      const { brains, brainsStaking, lockedStake, liquidStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('90'), LockType.PreSale);

      await brainsStaking.stakeFor(other.address, ethers.parseEther('10'), LockType.PreSale);

      expect(await lockedStake.balanceOf(other.address)).to.be.eq(0);
      expect(await liquidStake.balanceOf(other.address)).to.be.eq(1);
      const liquidStakeId = await liquidStake.tokenOfOwnerByIndex(other.address, 0);
      const liquidStakeInfo = await brainsStaking.getLiquidStakeInfo(liquidStakeId);
      expect(liquidStakeInfo.amount).to.be.eq(ethers.parseEther('100'));
      expect(liquidStakeInfo.lockType).to.be.eq(LockType.PreSale);
    });
  });
});
