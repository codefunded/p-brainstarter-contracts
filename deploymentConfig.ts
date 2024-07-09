import { ethers } from 'hardhat';

export const deploymentConfig = {
  Brains: {
    args: {
      initialSupply: ethers.parseEther(String(1_000_000_000n)),
      yearlyMintLimit: ethers.parseEther(String(100_000n)),
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
