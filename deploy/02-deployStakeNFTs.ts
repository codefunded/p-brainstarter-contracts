import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';

const deployStakeNFTs: DeployFunction = async function ({ getUnnamedAccounts, deployments }) {
  const { log, save } = deployments;
  const [deployer] = await getUnnamedAccounts();

  const LockedStakeFactory = await ethers.getContractFactory('LockedStake');
  const lockedStakeProxy = await upgrades.deployProxy(LockedStakeFactory, [deployer], {
    kind: 'uups',
  });
  await lockedStakeProxy.waitForDeployment();
  const lockedStake = await ethers.getContractAt('LockedStake', await lockedStakeProxy.getAddress());
  log(`LockedStake: ${await lockedStake.getAddress()}`);
  await save('LockedStake', {
    abi: lockedStake.interface.format(),
    address: await lockedStake.getAddress(),
  });

  const LiquidStakeFactory = await ethers.getContractFactory('LiquidStake');
  const liquidStakeProxy = await upgrades.deployProxy(LiquidStakeFactory, [deployer], {
    kind: 'uups',
  });
  await liquidStakeProxy.waitForDeployment();
  const liquidStake = await ethers.getContractAt('LiquidStake', await liquidStakeProxy.getAddress());
  log(`LiquidStake: ${await liquidStake.getAddress()}`);
  await save('LiquidStake', {
    abi: liquidStake.interface.format(),
    address: await liquidStake.getAddress(),
  });

  log('-----Stake NFTs deployed-----');
};

export default deployStakeNFTs;

deployStakeNFTs.tags = [];
