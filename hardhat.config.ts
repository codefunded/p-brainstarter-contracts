import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-deploy';
import '@openzeppelin/hardhat-upgrades';

const config: HardhatUserConfig = {
  solidity: '0.8.24',
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
