import hre, { ethers, upgrades } from 'hardhat';

export const INITIAL_SUPPLY = ethers.parseEther(String(1_000_000_000n));
export const YEARLY_MINT_LIMIT = ethers.parseEther(String(100_000n));

export async function deployBrains() {
  const [owner] = await hre.ethers.getSigners();

  const BrainsFactory = await hre.ethers.getContractFactory('Brains');
  const brainsProxy = await upgrades.deployProxy(
    BrainsFactory,
    [owner.address, INITIAL_SUPPLY, YEARLY_MINT_LIMIT],
    {
      kind: 'uups',
    },
  );
  await brainsProxy.waitForDeployment();
  const brains = await ethers.getContractAt('Brains', await brainsProxy.getAddress());

  const DopamineFactory = await hre.ethers.getContractFactory('Dopamine');
  const dopamineProxy = await upgrades.deployProxy(DopamineFactory, [owner.address], {
    kind: 'uups',
  });
  await dopamineProxy.waitForDeployment();
  const dopamine = await ethers.getContractAt(
    'Dopamine',
    await dopamineProxy.getAddress(),
  );

  const IlliquidStakeFactory = await hre.ethers.getContractFactory('IlliquidStake');
  const illiquidStakeProxy = await upgrades.deployProxy(
    IlliquidStakeFactory,
    [owner.address],
    {
      kind: 'uups',
    },
  );
  await illiquidStakeProxy.waitForDeployment();
  const illiquidStake = await ethers.getContractAt(
    'IlliquidStake',
    await illiquidStakeProxy.getAddress(),
  );

  const LiquidStakeFactory = await hre.ethers.getContractFactory('LiquidStake');
  const liquidStakeProxy = await upgrades.deployProxy(
    LiquidStakeFactory,
    [owner.address],
    {
      kind: 'uups',
    },
  );
  await liquidStakeProxy.waitForDeployment();
  const liquidStake = await ethers.getContractAt(
    'LiquidStake',
    await liquidStakeProxy.getAddress(),
  );

  const BrainsStakingFactory = await hre.ethers.getContractFactory('BrainsStaking');
  const brainsStakingProxy = await upgrades.deployProxy(
    BrainsStakingFactory,
    [
      owner.address,
      await brains.getAddress(),
      await illiquidStake.getAddress(),
      await liquidStake.getAddress(),
    ],
    {
      kind: 'uups',
    },
  );
  await brainsStakingProxy.waitForDeployment();

  const brainsStaking = await ethers.getContractAt(
    'BrainsStaking',
    await brainsStakingProxy.getAddress(),
  );

  await illiquidStake.grantRole(
    await illiquidStake.MANAGER_ROLE(),
    await brainsStakingProxy.getAddress(),
  );

  await liquidStake.grantRole(
    await liquidStake.MANAGER_ROLE(),
    await brainsStakingProxy.getAddress(),
  );

  return { brains, brainsStaking, illiquidStake, liquidStake, dopamine, owner };
}
