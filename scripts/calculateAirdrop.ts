import { ethers } from 'hardhat';

export interface CalculateAirdropProps {
  dopamineAddress: string;
  brainsStakingAddress: string;
  lockedStakeAddress: string;
  liquidStakeAddress: string;
  blockTimestamp: number;
  amountOfTokensToAirdrop: bigint;
  airdropTokenDecimals?: number;
  stakingTokenDecimals?: number;
}

export const calculateAirdrop = async ({
  dopamineAddress,
  brainsStakingAddress,
  lockedStakeAddress,
  liquidStakeAddress,
  blockTimestamp,
  amountOfTokensToAirdrop,
  airdropTokenDecimals = 18,
  stakingTokenDecimals = 18,
}: CalculateAirdropProps) => {
  const brainsStaking = await ethers.getContractAt('BrainsStaking', brainsStakingAddress);
  const lockedStake = await ethers.getContractAt('LockedStake', lockedStakeAddress);
  const liquidStake = await ethers.getContractAt('LiquidStake', liquidStakeAddress);
  const dopamine = await ethers.getContractAt('Dopamine', dopamineAddress);

  const stakers = new Map<string, { dopamine: bigint; stakedAmount: bigint; airdropAmount: bigint }>();
  const lockedStakeStakersAmount = await lockedStake.getStakersAmount({ blockTag: blockTimestamp });
  for (let i = 0; i < lockedStakeStakersAmount; i++) {
    const staker = await lockedStake.getStakerByIndex(i, {
      blockTag: blockTimestamp,
    });
    stakers.set(staker, {
      dopamine: ethers.parseEther('1'), // 1X
      stakedAmount: 0n,
      airdropAmount: 0n,
    });
  }
  const liquidStakeStakersAmount = await liquidStake.getStakersAmount();
  for (let i = 0; i < liquidStakeStakersAmount; i++) {
    const staker = await liquidStake.getStakerByIndex(i, {
      blockTag: blockTimestamp,
    });
    stakers.set(staker, {
      dopamine: ethers.parseEther('1'), // 1X
      stakedAmount: 0n,
      airdropAmount: 0n,
    });
  }

  for (const [staker] of stakers) {
    const dopamineLevel = await dopamine.balanceOf(staker, {
      blockTag: blockTimestamp,
    });
    const stakedAmount = await brainsStaking.getUserTotalStakedAmount(staker, {
      blockTag: blockTimestamp,
    });
    const stakerInfo = stakers.get(staker)!;
    stakers.set(staker, {
      dopamine: dopamineLevel === 0n ? ethers.parseEther('1') : dopamineLevel,
      stakedAmount: stakedAmount,
      airdropAmount: stakerInfo.airdropAmount,
    });
  }

  const totalSumOfStakedTokens = Array.from(stakers.values()).reduce(
    (acc, { dopamine, stakedAmount }) =>
      acc +
      ethers.parseUnits(
        (
          Number(ethers.formatUnits(stakedAmount, stakingTokenDecimals)) * Number(ethers.formatEther(dopamine))
        ).toString(),
        stakingTokenDecimals,
      ),
    0n,
  );
  const airdropPerToken =
    Number(ethers.formatUnits(amountOfTokensToAirdrop, airdropTokenDecimals)) /
    Number(ethers.formatUnits(totalSumOfStakedTokens, stakingTokenDecimals));

  for (const [staker, { dopamine, stakedAmount }] of stakers) {
    const airdropAmount = ethers.parseUnits(
      (
        Number(ethers.formatUnits(stakedAmount, stakingTokenDecimals)) *
        Number(ethers.formatEther(dopamine)) *
        airdropPerToken
      ).toString(),
      airdropTokenDecimals,
    );
    stakers.set(staker, { dopamine, stakedAmount, airdropAmount });
  }

  return stakers;
};
