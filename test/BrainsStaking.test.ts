import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployBrains } from './helpers/deploy';
import { LockType } from './helpers/LockType';

describe('BrainsStaking', function () {
  describe('illiquid stakes', () => {
    it('Should allow to stake tokens (even for other address)', async () => {
      const { brains, brainsStaking, illiquidStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('100'),
        LockType.Public,
      );
      const stakeId = await illiquidStake.getTokenIdFromAddress(other.address);

      expect(await illiquidStake.ownerOf(stakeId)).to.equal(other.address);
    });

    it('should allow to unstake tokens staked in illiquid type stake when no lock', async () => {
      const { brains, brainsStaking, illiquidStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('100'),
        LockType.Public,
      );
      const stakeId = await illiquidStake.getTokenIdFromAddress(other.address);

      expect(await illiquidStake.ownerOf(stakeId)).to.equal(other.address);

      await brainsStaking.connect(other).unstakeIlliquid();

      expect(await illiquidStake.balanceOf(other.address)).to.equal(0);
    });

    for (const lockType of [
      LockType.StrategicOrPrivate,
      LockType.Seed,
      LockType.Founder,
    ]) {
      it(`should not allow to unstake tokens staked in illiquid type stake when invested in ${LockType[lockType]} round`, async () => {
        const { brains, brainsStaking, illiquidStake } = await loadFixture(deployBrains);

        const [, other] = await ethers.getSigners();

        await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

        await brainsStaking.stakeFor(other.address, ethers.parseEther('100'), lockType);
        const stakeId = await illiquidStake.getTokenIdFromAddress(other.address);

        expect(await illiquidStake.ownerOf(stakeId)).to.equal(other.address);

        await expect(
          brainsStaking.connect(other).unstakeIlliquid(),
        ).to.be.revertedWithCustomError(
          brainsStaking,
          'UnlockFeeCalculator__CannotWithdrawWhenStakingIsStillObligatory',
        );
      });
    }
    it(`should only allow to unstake tokens with fee when staked in illiquid type stake and invested in ${LockType.PreSale} round`, async () => {
      const { brains, brainsStaking, illiquidStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('100'),
        LockType.PreSale,
      );
      const stakeId = await illiquidStake.getTokenIdFromAddress(other.address);

      expect(await illiquidStake.ownerOf(stakeId)).to.equal(other.address);

      await expect(
        brainsStaking.connect(other).unstakeIlliquid(),
      ).to.be.revertedWithCustomError(brainsStaking, 'BrainsStaking__StakeNotMatured');

      await brainsStaking.connect(other).unstakeIlliquidBeforeMaturedWithFee();

      expect(await illiquidStake.balanceOf(other.address)).to.equal(0);

      expect(await brains.balanceOf(other.address)).to.be.eq(ethers.parseEther('15'));
    });
  });

  describe('liquid stakes', () => {
    it('should allow to stake tokens when liquid threshold is set', async () => {
      const { brains, brainsStaking, liquidStake } = await loadFixture(deployBrains);

      const [, other, unlocker] = await ethers.getSigners();

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('100'),
        LockType.Public,
      );
      const amountOfLiquidStakes = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakes).to.equal(1);
      const stakeId = await liquidStake.tokenOfOwnerByIndex(other.address, 0);

      await liquidStake
        .connect(other)
        .transferFrom(other.address, unlocker.address, stakeId);

      expect(await liquidStake.ownerOf(stakeId)).to.equal(unlocker.address);

      await brainsStaking.connect(unlocker).unstakeLiquid(stakeId);

      expect(await liquidStake.balanceOf(unlocker.address)).to.equal(0);
      expect(await brains.balanceOf(unlocker.address)).to.be.eq(ethers.parseEther('100'));
    });

    it('if staked more than threshold, should also create illiquid stake with the remainder', async () => {
      const { brains, brainsStaking, liquidStake, illiquidStake } =
        await loadFixture(deployBrains);

      const [, other, unlocker] = await ethers.getSigners();

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('150'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('150'),
        LockType.Public,
      );
      const amountOfLiquidStakes = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakes).to.equal(1);
      const stakeId = await liquidStake.tokenOfOwnerByIndex(other.address, 0);

      await liquidStake
        .connect(other)
        .transferFrom(other.address, unlocker.address, stakeId);

      expect(await liquidStake.ownerOf(stakeId)).to.equal(unlocker.address);

      await brainsStaking.connect(unlocker).unstakeLiquid(stakeId);

      expect(await liquidStake.balanceOf(unlocker.address)).to.equal(0);
      expect(await brains.balanceOf(unlocker.address)).to.be.eq(ethers.parseEther('100'));

      expect(await illiquidStake.balanceOf(other.address)).to.equal(1);
      expect((await brainsStaking.getIlliquidStakeInfo(other.address)).amount).to.be.eq(
        ethers.parseEther('50'),
      );
    });

    it('if staked less than threshold and adds a new stake still below threshold it should update the illiquid stake', async () => {
      const { brains, brainsStaking, liquidStake, illiquidStake } =
        await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('50'));
      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('50'),
        LockType.Public,
      );

      const amountOfLiquidStakes = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakes).to.equal(0);

      expect(await liquidStake.balanceOf(other.address)).to.equal(0);
      expect((await brainsStaking.getIlliquidStakeInfo(other.address)).amount).to.be.eq(
        ethers.parseEther('50'),
      );

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('30'));
      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('30'),
        LockType.Public,
      );

      expect(await liquidStake.balanceOf(other.address)).to.equal(0);
      expect((await brainsStaking.getIlliquidStakeInfo(other.address)).amount).to.be.eq(
        ethers.parseEther('80'),
      );
    });

    it('when user already has existing illiquid stake and now stakes more than threshold, should create new liquid stakes and should keep the illiquid stake if there is remainder', async () => {
      const { brains, brainsStaking, liquidStake, illiquidStake } =
        await loadFixture(deployBrains);

      const [, other, unlocker] = await ethers.getSigners();

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('150'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('150'),
        LockType.Public,
      );
      const amountOfLiquidStakes = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakes).to.equal(1);
      expect(await illiquidStake.balanceOf(other.address)).to.equal(1);
      expect((await brainsStaking.getIlliquidStakeInfo(other.address)).amount).to.be.eq(
        ethers.parseEther('50'),
      );

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('60'));
      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('60'),
        LockType.Public,
      );
      const amountOfLiquidStakesAfterSecondStake = await liquidStake.balanceOf(
        other.address,
      );
      expect(amountOfLiquidStakesAfterSecondStake).to.equal(2);
      expect((await brainsStaking.getIlliquidStakeInfo(other.address)).amount).to.be.eq(
        ethers.parseEther('10'),
      );
    });
    it('when user already has existing illiquid stake and now stakes more than threshold, should create new liquid stakes and burn the illiquid stake if there is no remainder', async () => {
      const { brains, brainsStaking, liquidStake, illiquidStake } =
        await loadFixture(deployBrains);

      const [, other, unlocker] = await ethers.getSigners();

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('150'));

      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('150'),
        LockType.Public,
      );
      const amountOfLiquidStakes = await liquidStake.balanceOf(other.address);
      expect(amountOfLiquidStakes).to.equal(1);

      expect(await illiquidStake.balanceOf(other.address)).to.equal(1);
      expect((await brainsStaking.getIlliquidStakeInfo(other.address)).amount).to.be.eq(
        ethers.parseEther('50'),
      );

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('50'));
      await brainsStaking.stakeFor(
        other.address,
        ethers.parseEther('50'),
        LockType.Public,
      );
      const amountOfLiquidStakesAfterSecondStake = await liquidStake.balanceOf(
        other.address,
      );
      expect(amountOfLiquidStakesAfterSecondStake).to.equal(2);
      expect(await illiquidStake.balanceOf(other.address)).to.equal(1);
      expect((await brainsStaking.getIlliquidStakeInfo(other.address)).amount).to.be.eq(
        ethers.parseEther('0'),
      );
    });
  });
});
