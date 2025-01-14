import { MultiCall } from "@indexed-finance/multicall";
// @inherit from uniswap_v3/pool_states.ts
import type { ethers } from "ethers";
import { updateManySqrtWeights } from "../uniswap_v3/edge_weight";
import { QUERY_ALL_V2, client, pairAddresses } from "./../../constant";
import { computeV2WeightByGraphData, uniV2WeightRequest } from "./edge_weight";

/**
 * @notice Fetches pair data from the blockchain using multicall.
 * @param provider The provider to use for the blockchain connection.
 * @param addresses An array of contract addresses to fetch data for.
 * @param abi The contract ABI.
 * @param newConnection Boolean indicating if this is a new connection.
 * @param graphName The name of the graph in Redis.
 * @returns A promise that resolves with an array of responses.
 */
export async function getPairData(
  provider: ethers.providers.JsonRpcProvider,
  addresses: unknown[],
  abi: any,
  newConnection = false,
  graphName?: string
) {
  const multi: MultiCall = new MultiCall(provider);
  const response: any[] = [];
  let index = 0;

  if (newConnection) {
    // If it's a new connection, fetch additional data (token0, token1, factory)
    for (let i = 0; i < addresses.length; i += 15) {
      const part = [];

      for (let j = i; j < i + 15; j++) {
        if (addresses[j] === undefined) break;

        part.push(
          { target: addresses[j], function: "getReserves" },
          { target: addresses[j], function: "token0" },
          { target: addresses[j], function: "token1" },
          { target: addresses[j], function: "factory" }
        );
      }
      response.push(await multi.multiCall(abi, part));
    }
  } else {
    // If not a new connection, only fetch reserves and update graph
    for (let i = 0; i < addresses.length; i += 58) {
      const part = [];

      for (let j = i; j < i + 58; j++) {
        if (addresses[j] === undefined) break;

        part.push({ target: addresses[j], function: "getReserves" });
      }

      const multiCallResponse = await multi.multiCall(abi, part);

      await sendDataToGraph(graphName, multiCallResponse, addresses, index);
      index += multiCallResponse[1].length;

      if (index === addresses.length) {
        // Update sqrt weights after processing all addresses
        await updateManySqrtWeights(
          graphName,
          "r0:reserve_zero",
          QUERY_ALL_V2,
          computeV2WeightByGraphData,
          uniV2WeightRequest
        );
        console.log(true);
      }
    }
  }
  return response;
}

/**
 * @notice Updates the pair state in the graph database.
 * @param graphName The name of the graph in Redis.
 * @param provider The provider to use for the blockchain connection.
 * @param abi The contract ABI.
 */
export async function updatePairState(
  graphName: string,
  provider: ethers.providers.JsonRpcProvider,
  abi: any
): Promise<void> {
  const res = await pairAddresses(graphName);
  const addr = [...new Set(res[1].flat())];
  await getPairData(provider, addr, abi, false, graphName);
}

/**
 * @notice Sends fetched pair data to the graph database.
 * @param graphName The name of the graph in Redis.
 * @param pairsData An array containing the pair data.
 * @param addresses An array of contract addresses.
 * @param index The starting index for the addresses.
 */
async function sendDataToGraph(
  graphName: string,
  pairsData: [number, any[]],
  addresses: unknown[],
  index: number
): Promise<void> {
  for (let j = 0; j < pairsData[1].length; j++) {
    const pairReserves = pairsData[1];

    await client
      .query(
        `${graphName}`,
        `MATCH 
                (token0:Token)-[r0:reserve_zero {id: '${addresses[index]}'}]->
                (token1:Token)-[r1:reserve_one {id: '${
                  addresses[index + 1]
                }'}]->(token0:Token) 
            SET 
                r0.reserve0 = '${pairReserves[j].reserve0.toString()}', 
                r0.reserve1 = '${pairReserves[j].reserve1.toString()}',
                r1.reserve0 = '${pairReserves[j].reserve0.toString()}', 
                r1.reserve1 = '${pairReserves[j].reserve1.toString()}'`
      )
      .catch((err) => console.error("rUPDT_V2 \n", err.message));
  }
}
