# Brainstarter token contracts

This repository contains the smart contracts for the Brainstarter ERC20 token.

## Testing

In order to run unit tests use `npx hardhat test` command.

If you want to test the uniswap v3 integration, then edit the `hardhat.config.ts` file. Make the hardhat network be forking a real network like polygon and then run `npx hardhat run scripts/mintLiquidityPositionUniswapV3.ts --network networkName` to mint the liquidity on a localhost fork.

## Deployment

Edit values in `deploymentConfig.ts` file to configure the deployment.

Run `npx hardhat deploy --network natworkName` to deploy the contracts to the desired network.
