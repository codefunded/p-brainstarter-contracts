import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { deployBrains } from './helpers/deploy';

const INITIAL_SUPPLY = ethers.parseEther(String(1_000_000_000n));
const YEARLY_MINT_LIMIT = ethers.parseEther(String(100_000n));

describe('Brains', function () {
  describe('Deployment', function () {
    it('Should set the correct token symbol', async function () {
      const { brains } = await loadFixture(deployBrains);

      expect(await brains.symbol()).to.equal('BRAINS');
    });
  });

  describe('Upgrading', function () {
    it('Should upgrade the contract', async function () {
      const { owner, brains } = await loadFixture(deployBrains);

      const MockUpgradeableTokenFactory = await ethers.getContractFactory('MockUpgradeableToken');
      await upgrades.upgradeProxy(await brains.getAddress(), MockUpgradeableTokenFactory, {
        call: {
          fn: 'initialize',
          args: [owner.address],
        },
      });

      expect(await brains.symbol()).to.equal('MOCK');
      expect(await brains.owner()).to.equal(owner.address);
    });
  });

  describe('Burning', () => {
    it('Should allow everyone to burn tokens ', async () => {
      const { brains } = await loadFixture(deployBrains);

      const [owner, other] = await ethers.getSigners();
      const amount = ethers.parseEther('100');

      await brains.transfer(other.address, amount);
      await brains.connect(other).burn(amount);

      expect(await brains.balanceOf(other.address)).to.equal(0);
    });
  });

  describe('Batch transfer', () => {
    it('Should allow batch transfer', async () => {
      const { brains } = await loadFixture(deployBrains);

      const [, other, other2] = await ethers.getSigners();
      const amount = ethers.parseEther('100');

      await brains.batchTransfer([other.address, other2], [amount, amount]);

      expect(await brains.balanceOf(other.address)).to.equal(amount);
      expect(await brains.balanceOf(other2.address)).to.equal(amount);
    });
  });

  describe('Minting', () => {
    it('Should only allow the owner to mint tokens', async () => {
      const { brains } = await loadFixture(deployBrains);

      const amount = ethers.parseEther('100');

      const [, notAnOwner, otherAccount] = await ethers.getSigners();

      await brains.mint(otherAccount.address, amount);
      expect(await brains.balanceOf(otherAccount.address)).to.equal(amount);

      await expect(brains.connect(notAnOwner).mint(notAnOwner.address, amount)).to.be.revertedWithCustomError(
        brains,
        'OwnableUnauthorizedAccount',
      );
    });

    it('Should not allow minting after 5 years since deployment', async () => {
      const { brains } = await loadFixture(deployBrains);

      const amount = ethers.parseEther('100');

      const [, owner] = await ethers.getSigners();

      await time.increase(time.duration.years(5));
      await time.increase(time.duration.days(2)); // take leap years into account

      await expect(brains.mint(owner.address, amount)).to.be.revertedWithCustomError(brains, 'Brains__MintPeriodEnded');
    });

    it('Should not allow minting more than the yearly limit', async () => {
      const { brains, owner } = await loadFixture(deployBrains);

      const amount = YEARLY_MINT_LIMIT + ethers.parseEther('1');

      await expect(brains.mint(owner.address, amount)).to.be.revertedWithCustomError(
        brains,
        'Brains__MintLimitExceeded',
      );
    });

    it('Should allow minting up to the yearly limit', async () => {
      const { brains, owner } = await loadFixture(deployBrains);

      await brains.mint(owner.address, YEARLY_MINT_LIMIT);
      expect(await brains.totalSupply()).to.be.eq(INITIAL_SUPPLY + YEARLY_MINT_LIMIT);
    });

    it(`should allow minting next year after the first year's limit is reached`, async () => {
      const { brains, owner } = await loadFixture(deployBrains);

      await brains.mint(owner.address, YEARLY_MINT_LIMIT);
      await expect(brains.mint(owner.address, YEARLY_MINT_LIMIT)).to.be.revertedWithCustomError(
        brains,
        'Brains__MintLimitExceeded',
      );

      await time.increase(time.duration.years(1));

      await brains.mint(owner.address, YEARLY_MINT_LIMIT);
      expect(await brains.totalSupply()).to.be.eq(INITIAL_SUPPLY + YEARLY_MINT_LIMIT * 2n);
    });
  });
});
