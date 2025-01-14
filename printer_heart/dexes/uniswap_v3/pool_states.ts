import { MultiCall } from "@indexed-finance/multicall";
import type { ethers } from "ethers";
import { client, poolAddresses } from "./../../constant";
import { updateManySqrtWeights } from "./edge_weight";

/**
 * Fetches pool data using multicall.
 * @param provider - The Ethereum provider.
 * @param addresses - An array of pool addresses.
 * @param abi - The contract ABI.
 * @param newConnection - A flag indicating if it's a new connection.
 * @returns A promise that resolves to an array of pool data.
 */
export async function getPoolData(
  provider: ethers.providers.JsonRpcProvider,
  addresses: string[],
  abi: any,
  newConnection = false
) {
  const multi: MultiCall = new MultiCall(provider);
  const response: any[] = [];

  if (newConnection)
    for (let i = 0; i < addresses.length; i += 10) {
      const part = [];

      for (let j = i; j < i + 10; j++) {
        if (addresses[j] === undefined) break;

        part.push(
          { target: addresses[j], function: "liquidity" },
          { target: addresses[j], function: "slot0" },
          { target: addresses[j], function: "fee" },
          { target: addresses[j], function: "token0" },
          { target: addresses[j], function: "token1" }
        );
      }
      response.push(await multi.multiCall(abi, part));
    }
  else
    for (let i = 0; i < addresses.length; i += 27) {
      const part = [];

      for (let j = i; j < i + 27; j++) {
        if (addresses[j] === undefined) break;

        part.push(
          { target: addresses[j], function: "liquidity" },
          { target: addresses[j], function: "slot0" }
        );
      }
      response.push(await multi.multiCall(abi, part));
    }
  return response;
}

/**
 * Updates the pool state in the graph database.
 * @param graphName - The name of the graph.
 * @param provider - The Ethereum provider.
 * @param abi - The contract ABI.
 */
export async function updatePoolState(
  graphName: string,
  provider: ethers.providers.JsonRpcProvider,
  abi: any
) {
  const res = await poolAddresses(graphName);
  const addr = [...new Set(res[1].flat())];
  const poolsState = await getPoolData(provider, addr, abi);
  let index = -1;

  for (let i = 0; i < poolsState.length; i++)
    for (let j = 0; j < poolsState[i][1].length; j += 2) {
      const poolState = poolsState[i][1];
      index++;

      await client
        .query(
          `${graphName}`,
          `MATCH 
                    (token0:Token)-[st0:state_zero {id: '${addr[index]}'}]->
                    (token1:Token)-[st1:state_one {id: '${
                      addr[index]
                    }'}]->(token0:Token) 
                SET 
                    st0.liquidity = '${poolState[j].toString()}', 
                    st0.tick = ${poolState[j + 1].tick}, 
                    st1.tick = ${poolState[j + 1].tick}, 
                    st0.sqrtPrice = '${poolState[
                      j + 1
                    ].sqrtPriceX96.toString()}'`
        )
        .catch((err) => console.error("stUPDT_V3 \n", err.message));

      index === addr.length - 1 &&
        updateManySqrtWeights(graphName) &&
        console.log(index === addr.length - 1);
    }
}
