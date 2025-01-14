import Decimal from "decimal.js";
import { pipe } from "ramda";
import { client } from "../../constant";
import {
  QUERY_ADDR,
  QUERY_ALL,
  getAmount0Delta,
  getAmount1Delta,
  getSqrtRatio,
} from "../../constant";

Decimal.set({ precision: 36 });

/**
 * Calculates the square root weight for a Uniswap V3 pool.
 *
 * @param decimals0 The number of decimals for token0.
 * @param decimals1 The number of decimals for token1.
 * @param reserve0 The reserve of token0 (optional).
 * @param reserve1 The reserve of token1 (optional).
 * @param sqrtPX96 The current square root price (optional).
 * @param sqrtRatioAX96 The square root price at the lower bound of the tick (optional).
 * @param sqrtRatioBX96 The square root price at the upper bound of the tick (optional).
 * @param liquidity The liquidity of the pool (optional).
 * @param feeTier The fee tier of the pool (optional).
 * @returns An object containing amount0, amount1, and the calculated square root weight.
 */
export function getSqrtWeightX96(
  decimals0: number,
  decimals1: number,
  reserve0?: string,
  reserve1?: string,
  sqrtPX96?: bigint,
  sqrtRatioAX96?: bigint,
  sqrtRatioBX96?: bigint,
  liquidity?: bigint,
  feeTier?: number
): { amount0: bigint; amount1: bigint; sqrtWeight: Decimal } {
  const amount0 =
    getAmount0Delta(sqrtPX96, sqrtRatioBX96, liquidity, false) || 0n;
  const amount1 =
    getAmount1Delta(sqrtRatioAX96, sqrtPX96, liquidity, false) || 0n;

  if (
    (amount0 > 0n && amount1 > 0n) ||
    (reserve0 != null && reserve0 > "0" && reserve1 != null && reserve1 > "0")
  ) {
    const decimalPoint = (amount: Decimal) =>
      amount.mul(Decimal.pow(10, decimals1 - decimals0));
    const amountLog = (amount: Decimal) => Decimal.ln(amount).neg();
    const numerator = (amount: Decimal) => amount.mul(2 ** 96);

    const mergeAll = (amount: Decimal) =>
      pipe(decimalPoint, amountLog, numerator)(amount);

    if (reserve0) {
      const reservesRatio = Decimal.div(reserve0, reserve1).mul(997).div(1000);
      return {
        amount0:
          Number(reserve0) > 10 ** (decimals0 + 1)
            ? (BigInt(reserve0).valueOf() * 300n) / 1000000n
            : BigInt(reserve0) - 1n,
        amount1:
          Number(reserve1) > 10 ** (decimals1 + 1)
            ? (BigInt(reserve1).valueOf() * 300n) / 1000000n
            : BigInt(reserve1) - 1n,
        sqrtWeight: mergeAll(reservesRatio),
      };
    }
    const amountsRatio = Decimal.div(
      amount0.toString(),
      amount1.toString()
    ).mul((1000000 - feeTier) / 1000000);
    return {
      amount0: amount0,
      amount1: amount1,
      sqrtWeight: mergeAll(amountsRatio),
    };
  }
  return { amount0: 0n, amount1: 0n, sqrtWeight: new Decimal(0) };
}

/**
 *  Represents the data structure for the result of compute functions
 */
interface SqrtWeightData {
  amount0: bigint;
  amount1: bigint;
  sqrtWeight: Decimal;
}

/**
 *  Generic function to post the calculated sqrtWeight to the graph database
 *
 * @param graphName The name of the graph.
 * @param computeFn A function that computes the sqrtWeight data from a record.
 * @param postFn A function that posts the sqrtWeight data to the graph.
 * @param res An array of records to process.
 */
export async function postSqrtWeight(
  graphName: string,
  computeFn: (record: any[]) => SqrtWeightData,
  postFn: (
    data: SqrtWeightData,
    address: string,
    graphName: string
  ) => Promise<void>,
  res: any[]
) {
  for (const record of res) {
    const address = record[0];
    await postFn(computeFn(record), address, graphName);
  }
}

/**
 *  Computes the sqrtWeight data for a Uniswap V3 pool from graph data.
 *
 * @param record An array of data from the graph.
 * @returns The computed sqrtWeight data.
 */
export function computeV3WeightByGraphData(record: any[]): SqrtWeightData {
  const sqrtRatioAX96 = getSqrtRatio(record[2], record[4], true);
  const sqrtRatioBX96 = getSqrtRatio(record[2], record[4], false);

  return getSqrtWeightX96(
    record[6], //decimals0
    record[7], //decimals1
    undefined,
    undefined,
    BigInt(record[3]), //sqrtPX96
    sqrtRatioAX96,
    sqrtRatioBX96,
    BigInt(record[1]), //liquidity
    record[5] //feeTier
  );
}

/**
 *  Sends a query to update the sqrtWeight in the graph database for a single pool.
 *
 * @param data The sqrtWeight data to post.
 * @param address The address of the pool.
 * @param graphName The name of the graph.
 */
export async function uniV3WeightRequest(
  data: SqrtWeightData,
  address: string,
  graphName: string
) {
  client
    .query(
      `${graphName}`,
      `MATCH 
            (token0:Token)-[st0:state_zero {id: '${address}'}]->
            (token1:Token)-[st1:state_one {id: '${address}'}]->(token0:Token) 
        SET 
            st0.sqrtWeight = '${data.sqrtWeight.toFixed(0)}', 
            st0.amount = '${data.amount1.toString()}', 
            st1.sqrtWeight = '${data.sqrtWeight.neg().toFixed(0)}', 
            st1.amount = '${data.amount0.toString()}'`
    )
    .catch((err) => console.error("wUPDT_V3", err.message));
}

/**
 *  Updates the sqrtWeight for a single pool in the graph database.
 *
 * @param graphName The name of the graph.
 * @param address The address of the pool.
 * @param prefix The prefix for the query (optional).
 * @param struc The structure for the query (optional).
 * @param queryString The query string (optional).
 * @param computeFn The function to compute the sqrtWeight data (optional).
 * @param postFn The function to post the sqrtWeight data (optional).
 */
export async function updateSingleSqrtWeight(
  graphName: string,
  address: string,
  prefix?: string,
  struc?: string,
  queryString: string = QUERY_ALL,
  computeFn: (record: any[]) => SqrtWeightData = computeV3WeightByGraphData,
  postFn: (
    data: SqrtWeightData,
    address: string,
    graphName: string
  ) => Promise<void> = uniV3WeightRequest
) {
  await client
    .query(
      `${graphName}`,
      `${QUERY_ADDR(address, prefix, struc)} ${queryString}`
    )
    .then((res) => postSqrtWeight(graphName, computeFn, postFn, res[1]))
    .catch((err) => console.error("dGET_V2/V3", err.message));
}

/**
 *  Updates the sqrtWeight for multiple pools in the graph database.
 *
 * @param graphName The name of the graph.
 * @param index The index for the query (optional).
 * @param queryString The query string (optional).
 * @param computeFn The function to compute the sqrtWeight data (optional).
 * @param postFn The function to post the sqrtWeight data (optional).
 */
export async function updateManySqrtWeights(
  graphName: string,
  index = "st0:state_zero",
  queryString: string = QUERY_ALL,
  computeFn: (record: any[]) => SqrtWeightData = computeV3WeightByGraphData,
  postFn: (
    data: SqrtWeightData,
    address: string,
    graphName: string
  ) => Promise<void> = uniV3WeightRequest
) {
  const res = await client
    .query(
      `${graphName}`,
      `MATCH 
            (token0:Token)-[${index}]->(token1:Token) 
            ${queryString}`
    )
    .catch((err) => console.error("dGET_V3 \n", err.message));

  if (res && res[1]) postSqrtWeight(graphName, computeFn, postFn, res[1]);
}
