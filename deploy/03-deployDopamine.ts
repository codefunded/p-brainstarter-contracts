import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { deploymentConfig } from '../deploymentConfig';

const deployDopamine: DeployFunction = async function ({
  getUnnamedAccounts,
  deployments,
}) {
  const { log } = deployments;
  const [deployer] = await getUnnamedAccounts();

  const DopamineFactory = await ethers.getContractFactory('Dopamine');

  const dopamine = await upgrades.deployProxy(DopamineFactory, [deployer], {
    kind: 'uups',
  });
  await dopamine.waitForDeployment();
  log(`Dopamine: ${await dopamine.getAddress()}`);

  log('-----Dopamine deployed-----');
};

export default deployDopamine;

deployDopamine.tags = [];
