import { ethers } from 'hardhat';

export interface CalculateAirdropProps {
  dopamineAddress: string;
  brainsStakingAddress: string;
  blockTimestamp: number;
  amountOfTokensToAirdrop: bigint;
  airdropTokenDecimals?: number;
  stakingTokenDecimals?: number;
}

export const calculateAirdrop = async ({
  dopamineAddress,
  brainsStakingAddress,
  blockTimestamp,
  amountOfTokensToAirdrop,
  airdropTokenDecimals = 18,
  stakingTokenDecimals = 18,
}: CalculateAirdropProps) => {
  const brainsStaking = await ethers.getContractAt('BrainsStaking', brainsStakingAddress);
  const dopamine = await ethers.getContractAt('Dopamine', dopamineAddress);

  const amountOfStakers = await brainsStaking.getStakersAmount({
    blockTag: blockTimestamp,
  });
  const stakers = new Map<string, { dopamine: bigint; stakedAmount: bigint; airdropAmount: bigint }>();
  for (let i = 0; i < amountOfStakers; i++) {
    const staker = await brainsStaking.getStakerByIndex(i, {
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
