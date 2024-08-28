import { ethers } from 'hardhat';

export const deploymentConfig = {
  Brains: {
    args: {
      initialSupply: ethers.parseEther(String(1_100_000_000n)),
      yearlyMintLimit: ethers.parseEther(String(200_000_000n)),
      name: "$BRAINS",
      symbol: "$BRAINS",
    },
  },
  Locker: {
    args: {
      preSaleToken: ethers.ZeroAddress,
      strategicOrPrivateSaleToken: ethers.ZeroAddress,
      seedToken: ethers.ZeroAddress,
    },
  },
};
