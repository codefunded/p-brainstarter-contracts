import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { deploymentConfig } from '../deploymentConfig';

const deployStakingAndLocker: DeployFunction = async function ({ getNamedAccounts, deployments }) {
  const { log, get } = deployments;
  const { owner } = await getNamedAccounts();
  const deployer = owner;

  const brains = await get('Brains');
  const liquidStakeDeployment = await get('LiquidStake');
  const liquidStake = await ethers.getContractAt('LiquidStake', liquidStakeDeployment.address);
  const lockedStakeDeployment = await get('LockedStake');
  const lockedStake = await ethers.getContractAt('LockedStake', lockedStakeDeployment.address);

  const BrainsStakingFactory = await ethers.getContractFactory('BrainsStaking');
  const brainsStakingProxy = await upgrades.deployProxy(
    BrainsStakingFactory,
    [deployer, brains.address, await lockedStake.getAddress(), await liquidStake.getAddress()],
    {
      kind: 'uups',
    },
  );
  await brainsStakingProxy.waitForDeployment();
  const stakingAddress = await brainsStakingProxy.getAddress();
  log(`BrainsStaking: ${stakingAddress}`);

  await lockedStake.grantRole(await lockedStake.MANAGER_ROLE(), await brainsStakingProxy.getAddress());
  log(`Executed grantRole lockedStake manager role to proxy`);
  await liquidStake.grantRole(await liquidStake.MANAGER_ROLE(), await brainsStakingProxy.getAddress());
  log(`Executed grantRole liquidStake manager role to proxy`);

  const ReceiptLocker = await ethers.getContractFactory('BrainsReceiptLocker');
  const receiptLocker = await upgrades.deployProxy(
    ReceiptLocker,
    [
      deployer,
      stakingAddress,
      brains.address,
      deploymentConfig.Locker.args.preSaleToken,
      deploymentConfig.Locker.args.strategicOrPrivateSaleToken,
      deploymentConfig.Locker.args.seedToken,
    ],
    {
      kind: 'uups',
    },
  );
  await receiptLocker.waitForDeployment();
  log(`ReceiptLocker: ${await receiptLocker.getAddress()}`);

  log('-----Staking and Locker deployed-----');
};

export default deployStakingAndLocker;

deployStakingAndLocker.tags = ['stake', 'all'];
