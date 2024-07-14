import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';

const deployStakeNFTs: DeployFunction = async function ({
  getUnnamedAccounts,
  deployments,
}) {
  const { log, save } = deployments;
  const [deployer] = await getUnnamedAccounts();

  const IlliquidStakeFactory = await ethers.getContractFactory('IlliquidStake');
  const illiquidStakeProxy = await upgrades.deployProxy(
    IlliquidStakeFactory,
    [deployer],
    {
      kind: 'uups',
    },
  );
  await illiquidStakeProxy.waitForDeployment();
  const illiquidStake = await ethers.getContractAt(
    'IlliquidStake',
    await illiquidStakeProxy.getAddress(),
  );
  log(`IlliquidStake: ${await illiquidStake.getAddress()}`);
  await save('IlliquidStake', {
    abi: illiquidStake.interface.format(),
    address: await illiquidStake.getAddress(),
  });

  const LiquidStakeFactory = await ethers.getContractFactory('LiquidStake');
  const liquidStakeProxy = await upgrades.deployProxy(LiquidStakeFactory, [deployer], {
    kind: 'uups',
  });
  await liquidStakeProxy.waitForDeployment();
  const liquidStake = await ethers.getContractAt(
    'LiquidStake',
    await liquidStakeProxy.getAddress(),
  );
  log(`LiquidStake: ${await liquidStake.getAddress()}`);
  await save('LiquidStake', {
    abi: liquidStake.interface.format(),
    address: await liquidStake.getAddress(),
  });

  log('-----Stake NFTs deployed-----');
};

export default deployStakeNFTs;

deployStakeNFTs.tags = [];
