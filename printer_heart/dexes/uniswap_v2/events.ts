import { QUERY_ALL_V2, client } from "../../constant";
import { updateSingleSqrtWeight } from "../uniswap_v3/edge_weight";
import { computeV2WeightByGraphData, uniV2WeightRequest } from "./edge_weight";

/**
 * @notice Set of addresses for which pairs have been created.
 */
export const createPairs = new Set<string>();

/**
 * @notice Represents the structure of a sync event.
 */
interface SyncEvent {
  address: string;
  type: string;
  reserve0?: string;
  reserve1?: string;
}

/**
 * @notice Updates the graph with data from a sync event for Uniswap V2 pools.
 * @param graphName The name of the graph in Redis.
 * @param addresses An array of existing addresses in the graph.
 * @param stateEvent The sync event data.
 * @returns A Promise that resolves when the graph is updated or rejects if there is an error.
 */
export async function updateGraphbySync(
  graphName: string,
  addresses: string[],
  stateEvent: SyncEvent
): Promise<void> {
  const isAddressExisting = new Set(addresses).has(stateEvent.address);

  if (isAddressExisting && stateEvent.type === "Sync") {
    try {
      await Promise.all([
        client.query(
          graphName,
          `MATCH 
            (token0:Token)-[r0:reserve_zero {id: '${stateEvent.address}'}]->
            (token1:Token)-[r1:reserve_one {id: '${
              stateEvent.address
            }'}]->(token0:Token) 
          SET 
            r0.reserve0 = '${stateEvent.reserve0?.toString()}', 
            r0.reserve1 = '${stateEvent.reserve1?.toString()}', 
            r1.reserve0 = '${stateEvent.reserve0?.toString()}', 
            r1.reserve1 = '${stateEvent.reserve1?.toString()}'`
        ),
        updateSingleSqrtWeight(
          graphName,
          stateEvent.address,
          "r",
          "reserve",
          QUERY_ALL_V2,
          computeV2WeightByGraphData,
          uniV2WeightRequest
        ),
      ]);
    } catch (err: any) {
      console.error("rUPDT_V2", err.message);
    }
  } else {
    createPairs.add(stateEvent.address);
  }
}
