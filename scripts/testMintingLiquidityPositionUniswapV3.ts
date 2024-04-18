import { encodeSqrtRatioX96 } from '@uniswap/v3-sdk';
import { ethers } from 'hardhat';
import { mintLiquidtyPositionUniswapV3 } from './mintLiquidityPositionUniswapV3';

async function main() {
  const erc20Factory = await ethers.getContractFactory('MockERC20');

  let tokenAAmount = BigInt(
    (process.env.TOKEN_A_AMOUNT as string) || ethers.parseEther('150000'),
  );
  let tokenBAmount = BigInt(
    (process.env.TOKEN_B_AMOUNT as string) || ethers.parseEther('100000'),
  );

  let tokenAAddress =
    (process.env.TOKEN_A_ADDRESS as string) ||
    (await (async () => {
      console.log('Deploying mock token A');
      let tokenA = await erc20Factory.deploy('AAA', 'AAA', tokenAAmount);
      return tokenA.getAddress();
    })());
  let tokenBAddress =
    (process.env.TOKEN_B_ADDRESS as string) ||
    (await (async () => {
      console.log('Deploying mock token B');
      let tokenB = await erc20Factory.deploy('BBB', 'BBB', tokenBAmount);
      return tokenB.getAddress();
    })());

  if (BigInt(tokenAAddress) > BigInt(tokenBAddress)) {
    [tokenAAddress, tokenBAddress] = [tokenBAddress, tokenAAddress];
    [tokenAAmount, tokenBAmount] = [tokenBAmount, tokenAAmount];
  }
  const price = encodeSqrtRatioX96(
    tokenBAmount.toString(),
    tokenAAmount.toString(),
  ).toString();

  console.log('Mining liquidity for', {
    tokenAAddress,
    tokenBAddress,
    tokenAAmount,
    tokenBAmount,
    price,
  });

  await mintLiquidtyPositionUniswapV3({
    tokenAAddress,
    tokenBAddress,
    tokenAAmount,
    tokenBAmount,
    price,
  });
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
