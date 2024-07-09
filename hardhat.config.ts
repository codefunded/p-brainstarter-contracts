import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-deploy';
import '@openzeppelin/hardhat-upgrades';

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
  // networks: {
  //   hardhat: {
  //     forking: {
  //       url: 'https://gateway.tenderly.co/public/polygon',
  //     },
  //   },
  // },
};

export default config;
