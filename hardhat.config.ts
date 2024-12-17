import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-deploy';
import '@openzeppelin/hardhat-upgrades';
import { env } from './env';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.26',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    ],
  },
  // used for testing uniswap v3 liquidity position mint
  networks: {
    hardhat: {
      forking: {
        url: 'https://gateway.tenderly.co/public/polygon',
      },
    },
    polygon: {
      url: env.POLYGON_MAINNET_RPC,
      chainId: 137,
      accounts: [env.PRIVATE_KEY],
    },
  },
  namedAccounts: {
    owner: {
      default: 0,
    },
  },
  etherscan: {
    apiKey: env.POLYGONSCAN_API_KEY,
  },
  sourcify: {
    enabled: true
  }
};

export default config;
