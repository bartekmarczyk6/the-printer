import type Decimal from "decimal.js";
import { client } from "../../constant";
import { getSqrtWeightX96 } from "../uniswap_v3/edge_weight";

/**
 * @notice Computes the weight for a Uniswap V2 edge using data from a graph record.
 * @param record An array containing the necessary data for weight calculation.
 * The array is expected to have the following structure:
 *  - record[3]: decimals for token0
 *  - record[4]: decimals for token1
 *  - record[1]: reserve0
 *  - record[2]: reserve1
 * @returns The calculated sqrt weight as a bigint.
 */
export function computeV2WeightByGraphData(record: any[]) {
  return getSqrtWeightX96(
    record[3], //decimals0
    record[4], //decimals1
    record[1], //reserve0
    record[2] //reserve1
  );
}

/**
 * @notice Updates the sqrtWeight and amount properties on reserve edges in the graph.
 * @param data An object containing the amounts and sqrtWeight for the update.
 * @param address The address of the pool.
 * @param graphName The name of the graph in Redis.
 * @returns A Promise that resolves when the update is complete or rejects if there is an error.
 */
export const uniV2WeightRequest = async (
  data: {
    amount0: bigint;
    amount1: bigint;
    sqrtWeight: Decimal;
  },
  address: string,
  graphName: string
): Promise<void> => {
  await client
    .query(
      `${graphName}`,
      `MATCH 
            (token0:Token)-[r0:reserve_zero {id: '${address}'}]->
            (token1:Token)-[r1:reserve_one {id: '${address}'}]->(token0:Token) 
        SET 
            r0.sqrtWeight = '${data.sqrtWeight.toFixed(0)}', 
            r0.amount = '${data.amount1.toString()}', 
            r1.sqrtWeight = '${data.sqrtWeight.neg().toFixed(0)}', 
            r1.amount = '${data.amount0.toString()}'`
    )
    .catch((err) => console.error("wUPDT_v2", err.message));
};
