import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { deployBrains } from './helpers/deploy';
import { LockType } from './helpers/LockType';
import { calculateAirdrop } from '../scripts/calculateAirdrop';
describe('AirdropCalculation', () => {
  it('Should calculate airdrop correctly', async () => {
    const { brains, brainsStaking, dopamine, liquidStake, lockedStake } = await loadFixture(deployBrains);

    const [, user1, user2] = await ethers.getSigners();

    await brains.approve(brainsStaking.getAddress(), ethers.parseEther('2000'));

    await brainsStaking.stakeFor(user1.address, ethers.parseEther('500'), LockType.Public);

    await brainsStaking.stakeFor(user2.address, ethers.parseEther('1500'), LockType.Public);

    const airdropRecipients = await calculateAirdrop({
      dopamineAddress: await dopamine.getAddress(),
      brainsStakingAddress: await brainsStaking.getAddress(),
      liquidStakeAddress: await liquidStake.getAddress(),
      lockedStakeAddress: await lockedStake.getAddress(),
      blockTimestamp: await ethers.provider.getBlockNumber(),
      amountOfTokensToAirdrop: ethers.parseEther('10000'),
    });

    expect(airdropRecipients.get(user1.address)?.airdropAmount).to.equal(ethers.parseEther('2500'));
    expect(airdropRecipients.get(user2.address)?.airdropAmount).to.equal(ethers.parseEther('7500'));
  });

  it('Should take dopamine into consideration when calculating airdrop', async () => {
    const { brains, brainsStaking, dopamine, liquidStake, lockedStake } = await loadFixture(deployBrains);

    const [admin, user1, user2] = await ethers.getSigners();

    await brains.approve(brainsStaking.getAddress(), ethers.parseEther('2000'));
    await dopamine.mint(admin.address, ethers.parseEther('3'));
    await dopamine.transfer(user1.address, ethers.parseEther('3'));

    await brainsStaking.stakeFor(user1.address, ethers.parseEther('500'), LockType.Public);

    await brainsStaking.stakeFor(user2.address, ethers.parseEther('1500'), LockType.Public);

    const airdropRecipients = await calculateAirdrop({
      dopamineAddress: await dopamine.getAddress(),
      brainsStakingAddress: await brainsStaking.getAddress(),
      liquidStakeAddress: await liquidStake.getAddress(),
      lockedStakeAddress: await lockedStake.getAddress(),
      blockTimestamp: await ethers.provider.getBlockNumber(),
      amountOfTokensToAirdrop: ethers.parseEther('10000'),
    });

    expect(airdropRecipients.get(user1.address)?.airdropAmount).to.equal(ethers.parseEther('5000'));
    expect(airdropRecipients.get(user2.address)?.airdropAmount).to.equal(ethers.parseEther('5000'));
  });
});
