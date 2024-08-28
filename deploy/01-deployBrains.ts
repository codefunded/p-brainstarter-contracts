import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades, getNamedAccounts } from 'hardhat';
import { deploymentConfig } from '../deploymentConfig';

const deployBrains: DeployFunction = async function ({
  deployments,
}) {
  const { log, save } = deployments;
  const { owner } = await getNamedAccounts();
  const BrainsFactory = await ethers.getContractFactory('Brains');

  const brains = await upgrades.deployProxy(
    BrainsFactory,
    [
      owner,
      deploymentConfig.Brains.args.initialSupply,
      deploymentConfig.Brains.args.yearlyMintLimit,
      deploymentConfig.Brains.args.name,
      deploymentConfig.Brains.args.symbol,
    ],
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
