import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { deploymentConfig } from '../deploymentConfig';

const deployStakeNFTs: DeployFunction = async function ({ getUnnamedAccounts, deployments }) {
  const { log, get } = deployments;
  const [deployer] = await getUnnamedAccounts();

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
  log(`BrainsStaking: ${await brainsStakingProxy.getAddress()}`);

  await lockedStake.grantRole(await lockedStake.MANAGER_ROLE(), await brainsStakingProxy.getAddress());

  await liquidStake.grantRole(await liquidStake.MANAGER_ROLE(), await brainsStakingProxy.getAddress());

  const ReceiptLocker = await ethers.getContractFactory('BrainsReceiptLocker');
  const receiptLocker = await upgrades.deployProxy(
    ReceiptLocker,
    [
      deployer,
      await brainsStakingProxy.getAddress(),
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

export default deployStakeNFTs;

deployStakeNFTs.tags = [];
