import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { deployBrains } from './helpers/deploy';
import { ethers } from 'hardhat';
import { LockType } from './helpers/LockType';

describe('LiquidStake', function () {
  describe('Stakers', function () {
    it('Should add address to stakes when stake is started', async function () {
      const { brains, brainsStaking, liquidStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('100'), LockType.Public);

      expect(await liquidStake.totalSupply()).to.equal(1);
      expect(await liquidStake.getStakersAmount()).to.equal(1);
      expect(await liquidStake.getStakerByIndex(0)).to.equal(other.address);
    });

    it('Should remove address from stakes when unstakes', async function () {
      const { brains, brainsStaking, liquidStake } = await loadFixture(deployBrains);

      const [, other] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('100'), LockType.Public);

      expect(await liquidStake.totalSupply()).to.equal(1);
      expect(await liquidStake.getStakersAmount()).to.equal(1);
      expect(await liquidStake.getStakerByIndex(0)).to.equal(other.address);
      const liquidStakeId = await liquidStake.tokenOfOwnerByIndex(other.address, 0);
      await brainsStaking.connect(other).unstakeLiquid(liquidStakeId);

      expect(await liquidStake.totalSupply()).to.equal(0);
      expect(await liquidStake.getStakersAmount()).to.equal(0);
    });

    it('should update stakers when liquid stake is sent', async function () {
      const { brains, brainsStaking, liquidStake } = await loadFixture(deployBrains);

      const [, other, target] = await ethers.getSigners();

      await brains.approve(brainsStaking.getAddress(), ethers.parseEther('100'));

      await brainsStaking.setLiquidStakeThreshold(ethers.parseEther('100'));

      await brainsStaking.stakeFor(other.address, ethers.parseEther('100'), LockType.Public);

      expect(await liquidStake.totalSupply()).to.equal(1);
      expect(await liquidStake.getStakersAmount()).to.equal(1);
      expect(await liquidStake.getStakerByIndex(0)).to.equal(other.address);
      const liquidStakeId = await liquidStake.tokenOfOwnerByIndex(other.address, 0);
      await liquidStake.connect(other).transferFrom(other.address, target.address, liquidStakeId);

      expect(await liquidStake.totalSupply()).to.equal(1);
      expect(await liquidStake.getStakersAmount()).to.equal(1);
      expect(await liquidStake.getStakerByIndex(0)).to.equal(target.address);
    });
  });
});
