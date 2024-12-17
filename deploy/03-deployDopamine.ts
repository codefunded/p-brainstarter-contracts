import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';

const deployDopamine: DeployFunction = async function ({ getNamedAccounts, deployments }) {
  const { log } = deployments;
  const { owner } = await getNamedAccounts();

  const DopamineFactory = await ethers.getContractFactory('Dopamine');

  const dopamine = await upgrades.deployProxy(DopamineFactory, [owner], {
    kind: 'uups',
  });
  await dopamine.waitForDeployment();
  log(`Dopamine: ${await dopamine.getAddress()}`);

  log('-----Dopamine deployed-----');
};

export default deployDopamine;

deployDopamine.tags = ["all", "dopamine"];
