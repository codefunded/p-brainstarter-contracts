import { ethers } from 'hardhat';
import { FeeAmount, Pool, Position, NonfungiblePositionManager } from '@uniswap/v3-sdk';
import UniswapV3FactoryABI from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import NonfungiblePositionManagerABI from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import UniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json';
import { Percent, Token } from '@uniswap/sdk-core';

const UNISWAP_V3_CORE_POLYGON_DEPLOYMENTS = {
  UniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  SwapRouter02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  NonfungiblePositionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  UniversalRouter: '0xec7BE89e9d109e7e3Fec59c222CF297125FEFda2',
};

type MintLiquidityPositionUniswapV3Args = {
  tokenAAddress: string;
  tokenBAddress: string;
  tokenAAmount: bigint;
  tokenBAmount: bigint;
  price: string;
  fee?: FeeAmount;
};

async function getPoolData(poolContract: any) {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    tickSpacing,
    fee,
    liquidity,
    sqrtPriceX96: slot0.sqrtPriceX96 || slot0[0],
    tick: slot0.tick || slot0[1],
  };
}

export async function mintLiquidtyPositionUniswapV3({
  tokenAAddress,
  tokenAAmount,
  tokenBAddress,
  tokenBAmount,
  price,
  fee = FeeAmount.MEDIUM,
}: MintLiquidityPositionUniswapV3Args) {
  const isABigger = BigInt(tokenAAddress) > BigInt(tokenBAddress);
  if (isABigger) {
    throw new Error(
      'Order tokens by address in ascending order, otherwise Uniswap will fail',
    );
  }
  const tokenA = await ethers.getContractAt('ERC20Upgradeable', tokenAAddress);
  const tokenB = await ethers.getContractAt('ERC20Upgradeable', tokenBAddress);

  const nonfungiblePositionManager = await ethers.getContractAt(
    NonfungiblePositionManagerABI.abi,
    UNISWAP_V3_CORE_POLYGON_DEPLOYMENTS.NonfungiblePositionManager,
  );
  const factory = await ethers.getContractAt(
    UniswapV3FactoryABI.abi,
    UNISWAP_V3_CORE_POLYGON_DEPLOYMENTS.UniswapV3Factory,
  );

  const [deployer] = await ethers.getSigners();

  console.log('Creating pool if necessary');
  await (
    nonfungiblePositionManager.connect(deployer) as any
  ).createAndInitializePoolIfNecessary(
    tokenAAddress,
    tokenBAddress,
    FeeAmount.MEDIUM,
    price,
  );

  const poolAddress: string = await (factory.connect(deployer) as any).getPool(
    tokenAAddress,
    tokenBAddress,
    FeeAmount.MEDIUM,
  );
  console.log('Pool address:', poolAddress);

  console.log('Approving tokens');
  await tokenA.approve(
    UNISWAP_V3_CORE_POLYGON_DEPLOYMENTS.NonfungiblePositionManager,
    tokenAAmount,
  );
  await tokenB.approve(
    UNISWAP_V3_CORE_POLYGON_DEPLOYMENTS.NonfungiblePositionManager,
    tokenBAmount,
  );

  const poolContract = await ethers.getContractAt(UniswapV3PoolABI.abi, poolAddress);

  console.log('Getting pool data');
  const poolData = await getPoolData(poolContract);
  console.log('poolData', poolData);

  const chainId = (await ethers.provider.getNetwork()).chainId;

  const uniTokenA = new Token(Number(chainId), tokenAAddress, 18, 'AAA', 'AAA');
  const uniTokenB = new Token(Number(chainId), tokenBAddress, 18, 'BBB', 'BBB');

  const pool = new Pool(
    uniTokenA,
    uniTokenB,
    fee,
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    Number(poolData.tick),
    poolData.tickSpacing,
  );

  const position = Position.fromAmounts({
    pool,
    // V2 like position, whole range covered
    tickLower: -887220, // tick spacing for 0.3%, 0.1% and 0.05% fee pools
    tickUpper: 887220,
    amount0: tokenAAmount.toString(),
    amount1: tokenBAmount.toString(),
    useFullPrecision: false,
  });

  const mintOptions = {
    recipient: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
    slippageTolerance: new Percent(50, 10_000),
  };

  const { calldata, value } = NonfungiblePositionManager.addCallParameters(
    position,
    mintOptions,
  );

  console.log('Adding liquidity');
  await deployer.sendTransaction({
    data: calldata,
    to: UNISWAP_V3_CORE_POLYGON_DEPLOYMENTS.NonfungiblePositionManager,
    value,
    from: deployer.address,
  });
  console.log('Liquidity added');
  const poolData2 = await getPoolData(poolContract);

  console.log('pool data after mint', poolData2);

  const deployerATokenBalance = await tokenA.balanceOf(deployer.address);
  const deployerBTokenBalance = await tokenB.balanceOf(deployer.address);
  const poolATokenBalance = await tokenA.balanceOf(poolAddress);
  const poolBTokenBalance = await tokenB.balanceOf(poolAddress);
  console.log('deployerATokenBalance', deployerATokenBalance.toString());
  console.log('deployerBTokenBalance', deployerBTokenBalance.toString());
  console.log('poolATokenBalance', poolATokenBalance.toString());
  console.log('poolBTokenBalance', poolBTokenBalance.toString());
}
