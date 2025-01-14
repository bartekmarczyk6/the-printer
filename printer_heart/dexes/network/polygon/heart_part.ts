import { abi as abiV2 } from "@uniswap/v2-core/build/IUniswapV2Pair.json";
import { abi as abiV3 } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { updatePairState } from "../../uniswap_v2/pair_states";
import { getEvents } from "../../uniswap_v3/events";
import { updatePoolState } from "../../uniswap_v3/pool_states";
import { provider, providerWSS } from "./providers";

/**
 *  Initializes and updates the Polygon network data within the graph database.
 *  It fetches and updates pool and pair states, and sets up event listeners for real-time updates.
 * @param {string} graphName - The name of the graph to update.
 */
export async function polygonAtrium(graphName: string): Promise<void> {
  // Define the swap token address
  const swapToken: string = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

  console.time("Update data in graph");
  // Update both V3 pools and V2 pairs in parallel
  await Promise.all([
    updatePoolState(graphName, provider, abiV3),
    updatePairState(graphName, provider, abiV2),
  ]);
  console.timeEnd("Update data in graph");

  // Start listening for events and update the graph in real-time
  getEvents(
    graphName,
    provider,
    providerWSS,
    swapToken,
    [0, 1, 7, 8, 27], // Initial vertices for SPFA
    7, // Max hops for SPFA
    abiV2,
    abiV3
  );
}
