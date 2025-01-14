import "dotenv/config";
import Decimal from "decimal.js";
import { RedisGraph } from "redis-modules-sdk";
import invariant from "tiny-invariant";
import type {
  RedisGraphConfig,
  RouterMapping,
  TermTickSpacing,
} from "./types/common";

Decimal.set({ precision: 36 });

const redisConfig: RedisGraphConfig = {
  port: 7024,
  host: process.env.HOST,
  username: "default",
  password: process.env.PASSWORD,
};

export const client = new RedisGraph(redisConfig);

// Constants
/**
 * @notice Represents the resolution for fixed-point numbers (96 bits).
 */
export const RESOLUTION: bigint = BigInt(96);
/**
 * @notice Represents 2^96, often used in calculations involving fixed-point numbers.
 */
export const Q96: bigint = BigInt(2 ** 96);

/**
 * @notice Maps a given fee tier to its corresponding tick spacing.
 * @param feeTier The fee tier of the pool.
 * @returns The tick spacing for the given fee tier.
 */
export const tierToSpacing = (feeTier: number): number => {
  switch (feeTier) {
    case 10000:
      return 40;
    case 3000:
      return 12;
    case 500:
      return 3;
    default:
      return 1;
  }
};

/**
 * @notice Defines the tick spacing for different fee tiers.
 */
export const termTickSpacing: TermTickSpacing = {
  40: 200, //10000
  12: 60, //3000
  3: 10, //500
  1: 1, //100
};

/**
 * @notice Maps router addresses to their corresponding factory addresses.
 */
export const routers: RouterMapping = {
  "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32":
    "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", //QuickSwap
  "0xCf083Be4164828f00cAE704EC15a36D711491284":
    "0xc0788a3ad43d79aa53b09c2eacc313a787d1d607", //ApeSwap
  "0xc35DADB65012eC5796536bD9864eD8773aBc74C4":
    "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", //SushiSwap
  "0x668ad0ed2622C62E24f0d5ab6B6Ac1b9D2cD4AC7":
    "0x5C6EC38fb0e2609672BDf628B1fD605A523E5923", //JETSWAP
  "0x1d21Db6cde1b18c7E47B0F7F42f4b3F68b9beeC9":
    "0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e", //DYSTRouter
  "0x03DAa61d8007443a6584e3d8f85105096543C19c":
    "0xaD340d0CD0B117B0140671E7cB39770e7675C848", //DXSWAP

  "0x9F3044f7F9FC8bC9eD615d54845b4577B833282d":
    "0xd9276178f79631c3804f96B634c0250293CE8172", //?
  "0x477Ce834Ae6b7aB003cCe4BC4d8697763FF456FA":
    "0x94930a328162957FF1dd48900aF67B5439336cBD",
  "0xa98ea6356A316b44Bf710D5f9b6b4eA0081409Ef":
    "0x3a1D87f206D12415f5b0A33E786967680AAb4f6d",
  "0xE3BD06c7ac7E1CeB17BdD2E5BA83E40D1515AF2a":
    "0xf38a7A7Ac2D745E2204c13F824c00139DF831FFf",
  "0xE7Fb3e833eFE5F9c441105EB65Ef8b261266423B":
    "0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429", //DFYNSwap
  "0xEAA98F7b5f7BfbcD1aF14D0efAa9d9e68D82f640":
    "0xC60aE14F2568b102F8Ca6266e8799112846DD088", //PolyDEX
};

// Query functions
/**
 * @notice Fetches pool addresses from the specified graph.
 * @param graphName The name of the graph in Redis.
 * @returns A promise that resolves to a RedisGraphResponse containing pool addresses.
 */
export const poolAddresses = (graphName: string) =>
  client.query(graphName, "MATCH ()-[st0:state_zero]->() RETURN st0.id");

/**
 * @notice Fetches all addresses (both state and reserve) from the specified graph.
 * @param graphName The name of the graph in Redis.
 * @returns A promise that resolves to a RedisGraphResponse containing all addresses.
 */
export const addresses = (graphName: string) =>
  client.query(
    graphName,
    `MATCH ()-[st0:state_zero]->() RETURN st0.id AS id
    UNION ALL 
    MATCH ()-[r0:reserve_zero]->() RETURN r0.id AS id`
  );

/**
 * @notice Fetches pair addresses from the specified graph.
 * @param graphName The name of the graph in Redis.
 * @returns A promise that resolves to a RedisGraphResponse containing pair addresses.
 */
export const pairAddresses = (graphName: string) =>
  client.query(graphName, "MATCH ()-[r0:reserve_zero]->() RETURN r0.id");

/**
 * @notice Constructs a Cypher query string to match a specific address.
 * @param address The address to match.
 * @param prefix The prefix for the relationship (default is "st").
 * @param struc The structure of the relationship (default is "state").
 * @returns A Cypher query string.
 */
export const QUERY_ADDR = (
  address: string,
  prefix = "st",
  struc = "state"
): string =>
  `MATCH (token0:Token)-[${prefix}0:${struc}_zero {id:'${address}'}]->(token1:Token) `;

/**
 * @notice Cypher query string to return all state data.
 */
export const QUERY_ALL =
  "RETURN st0.id, st0.liquidity, st0.tick, st0.sqrtPrice, st0.tickSpacing, st0.feeTier, token0.decimals, token1.decimals";

/**
 * @notice Cypher query string to return all reserve data.
 */
export const QUERY_ALL_V2 =
  "RETURN r0.id, r0.reserve0, r0.reserve1, token0.decimals, token1.decimals";

// Math operations
/**
 * @notice Performs multiplication and division with rounding up.
 * @param a The first number.
 * @param b The second number.
 * @param denominator The denominator.
 * @returns The result of (a * b) / denominator, rounded up.
 */
const mulDivRoundingUp = (
  a: bigint,
  b: bigint,
  denominator: bigint
): bigint => {
  const product = a * b;
  let result = product / denominator;
  if (product % denominator !== 0n) {
    result++;
  }
  return result;
};

// Sqrt price math
/**
 * @notice Calculates the square root ratio based on a given tick, tick spacing, and whether it's a lower tick.
 * @param tick The current tick.
 * @param tickSpacing The tick spacing.
 * @param lowerTick Indicates if the target tick is lower than the current tick.
 * @returns The calculated square root ratio.
 */
export const getSqrtRatio = (
  tick: number,
  tickSpacing: number,
  lowerTick: boolean
): bigint => {
  const currentTickSpacing = termTickSpacing[tickSpacing];
  const targetTick = lowerTick
    ? tick - tickSpacing <
      Math.floor(tick / currentTickSpacing) * currentTickSpacing
      ? Math.floor(tick / currentTickSpacing) * currentTickSpacing
      : tick - tickSpacing
    : tick + tickSpacing >
      Math.floor(tick / currentTickSpacing) * currentTickSpacing +
        currentTickSpacing
    ? Math.floor(tick / currentTickSpacing) * currentTickSpacing +
      currentTickSpacing
    : tick + tickSpacing;

  return BigInt(
    Decimal.sqrt(1.0001 ** targetTick)
      .mul(Decimal.pow(2, 96))
      .toFixed(0)
  );
};

/**
 * @notice Calculates the delta of amount0.
 * @param sqrtPX96 The current sqrt price.
 * @param sqrtRatioBX96 The target sqrt price.
 * @param liquidity The liquidity.
 * @param roundUp Indicates whether to round up the result.
 * @returns The calculated delta of amount0.
 */
export function getAmount0Delta(
  sqrtPX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint | undefined {
  if (!liquidity) return;
  if (sqrtPX96 > sqrtRatioBX96) {
    [sqrtPX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtPX96];
  }

  const numerator1 = liquidity.valueOf() << RESOLUTION;
  const numerator2 = sqrtRatioBX96.valueOf() - sqrtPX96.valueOf();

  return roundUp
    ? mulDivRoundingUp(
        mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96),
        1n,
        sqrtPX96
      )
    : (numerator1 * numerator2) / sqrtRatioBX96.valueOf() / sqrtPX96.valueOf();
}

/**
 * @notice Calculates the delta of amount1.
 * @param sqrtRatioAX96 The initial sqrt price.
 * @param sqrtPX96 The current sqrt price.
 * @param liquidity The liquidity.
 * @param roundUp Indicates whether to round up the result.
 * @returns The calculated delta of amount1.
 */
export function getAmount1Delta(
  sqrtRatioAX96: bigint,
  sqrtPX96: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint | undefined {
  if (!liquidity) return;
  if (sqrtRatioAX96 > sqrtPX96) {
    [sqrtRatioAX96, sqrtPX96] = [sqrtPX96, sqrtRatioAX96];
  }

  return roundUp
    ? mulDivRoundingUp(
        liquidity,
        sqrtPX96.valueOf() - sqrtRatioAX96.valueOf(),
        Q96
      )
    : ((sqrtPX96.valueOf() - sqrtRatioAX96.valueOf()) * liquidity.valueOf()) /
        Q96;
}

// Sqrt price math
/**
 * @notice Calculates the next sqrt price from an output amount.
 * @param sqrtPX96 The current sqrt price.
 * @param liquidity The liquidity.
 * @param amountOut The output amount.
 * @param zeroForOne Indicates if the trade is zero for one.
 * @returns The next sqrt price.
 */
export function getNextSqrtPriceFromOutput(
  sqrtPX96: bigint,
  liquidity: bigint,
  amountOut: bigint | string,
  zeroForOne: boolean
): bigint {
  const amountOutBigInt = BigInt(amountOut);

  invariant(sqrtPX96 > 0n, "sqrtPX96 is lower than 0");
  invariant(liquidity > 0n, "liquidity is lower than 0");

  return zeroForOne
    ? getNextSqrtPriceFromAmount1RoundingDown(
        sqrtPX96,
        liquidity,
        amountOutBigInt,
        false
      )
    : getNextSqrtPriceFromAmount0RoundingUp(
        sqrtPX96,
        liquidity,
        amountOutBigInt,
        false
      );
}

/**
 * @notice Calculates the next sqrt price from an input amount.
 * @param sqrtPX96 The current sqrt price.
 * @param liquidity The liquidity.
 * @param amountIn The input amount.
 * @param zeroForOne Indicates if the trade is zero for one.
 * @returns The next sqrt price.
 */
export function getNextSqrtPriceFromInput(
  sqrtPX96: bigint,
  liquidity: bigint,
  amountIn: bigint | string,
  zeroForOne: boolean
): bigint {
  const amountInBigInt = BigInt(amountIn);

  invariant(sqrtPX96 > 0n, "sqrtPX96 is lower than 0");
  invariant(liquidity > 0n, "liquidity is lower than 0");

  return zeroForOne
    ? getNextSqrtPriceFromAmount0RoundingUp(
        sqrtPX96,
        liquidity,
        amountInBigInt,
        true
      )
    : getNextSqrtPriceFromAmount1RoundingDown(
        sqrtPX96,
        liquidity,
        amountInBigInt,
        true
      );
}

/**
 * @notice Calculates the next sqrt price from amount1 with rounding down.
 * @param sqrtPX96 The current sqrt price.
 * @param liquidity The liquidity.
 * @param amount The amount.
 * @param add Indicates if the amount is being added or subtracted.
 * @returns The next sqrt price.
 */
function getNextSqrtPriceFromAmount1RoundingDown(
  sqrtPX96: bigint,
  liquidity: bigint,
  amount: bigint,
  add: boolean
): bigint {
  const maxUint160 = BigInt(2 ** 160 - 1);

  if (add) {
    const quotient =
      amount <= maxUint160
        ? (amount.valueOf() << RESOLUTION) / liquidity.valueOf()
        : (amount.valueOf() * Q96) / liquidity.valueOf();

    return sqrtPX96.valueOf() + quotient;
  }
  const quotient = mulDivRoundingUp(amount, Q96, liquidity);

  return sqrtPX96.valueOf() - quotient.valueOf();
}

/**
 * @notice Calculates the next sqrt price from amount0 with rounding up.
 * @param sqrtPX96 The current sqrt price.
 * @param liquidity The liquidity.
 * @param amount The amount.
 * @param add Indicates if the amount is being added or subtracted.
 * @returns The next sqrt price.
 */
function getNextSqrtPriceFromAmount0RoundingUp(
  sqrtPX96: bigint,
  liquidity: bigint,
  amount: bigint,
  add: boolean
) {
  if (amount === BigInt(0)) return sqrtPX96;
  const numerator1 = liquidity.valueOf() << RESOLUTION;

  if (add) {
    const product = amount.valueOf() * sqrtPX96.valueOf();

    if (product.valueOf() / amount.valueOf() === sqrtPX96) {
      const denominator = numerator1.valueOf() + product.valueOf();
      if (denominator >= numerator1)
        return mulDivRoundingUp(numerator1, sqrtPX96, denominator);
    }
    return mulDivRoundingUp(
      numerator1,
      1n,
      numerator1.valueOf() / sqrtPX96.valueOf() + amount.valueOf()
    );
  }
  const product = amount.valueOf() * sqrtPX96.valueOf();

  invariant(
    product.valueOf() / amount.valueOf() === sqrtPX96,
    "is not equal to sqrtPX96"
  );
  invariant(numerator1 > product, "numerator1 is too small");
  const denominator = numerator1.valueOf() - product.valueOf();
  return mulDivRoundingUp(numerator1, sqrtPX96, denominator);
}

// UniswapV2 math
/**
 * @notice Calculates the input amount for a UniswapV2 swap.
 * @param inputReserve The input reserve.
 * @param outputReserve The output reserve.
 * @param outputAmount The output amount.
 * @param zeroForOne Indicates if the trade is zero for one.
 * @returns The calculated input amount.
 */
export function getInputAmount(
  inputReserve: bigint,
  outputReserve: bigint,
  outputAmount: bigint,
  zeroForOne: boolean
): bigint {
  if (!zeroForOne)
    [inputReserve, outputReserve] = [outputReserve, inputReserve];
  const numerator = inputReserve.valueOf() * outputAmount.valueOf();
  const denominator = outputReserve.valueOf() - outputAmount.valueOf();
  return numerator / denominator + 1n;
}

/**
 * @notice Calculates the output amount for a UniswapV2 swap.
 * @param inputReserve The input reserve.
 * @param outputReserve The output reserve.
 * @param inputAmount The input amount.
 * @param zeroForOne Indicates if the trade is zero for one.
 * @returns The calculated output amount.
 */
export function getOutputAmount(
  inputReserve: bigint,
  outputReserve: bigint,
  inputAmount: bigint,
  zeroForOne: boolean
): bigint {
  if (!zeroForOne)
    [inputReserve, outputReserve] = [outputReserve, inputReserve];
  const inputAmountWithFee = inputAmount.valueOf() * 997n;
  const numerator = inputAmountWithFee.valueOf() * outputReserve.valueOf();
  const denominator =
    inputReserve.valueOf() * 1000n + inputAmountWithFee.valueOf();
  return numerator / denominator;
}
