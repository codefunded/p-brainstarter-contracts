import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { deploymentConfig } from '../deploymentConfig';

const deployBrains: DeployFunction = async function ({ getUnnamedAccounts, deployments }) {
  const { log, save } = deployments;
  const [deployer] = await getUnnamedAccounts();

  const BrainsFactory = await ethers.getContractFactory('Brains');

  const brains = await upgrades.deployProxy(
    BrainsFactory,
    [deployer, deploymentConfig.Brains.args.initialSupply, deploymentConfig.Brains.args.yearlyMintLimit],
    {
      kind: 'uups',
    },
  );
  await brains.waitForDeployment();
  log(`BRAINS: ${await brains.getAddress()}`);
  await save('Brains', {
    abi: brains.interface.format(),
    address: await brains.getAddress(),
  });

  log('-----BRAINS deployed-----');
};

export default deployBrains;

deployBrains.tags = [];
