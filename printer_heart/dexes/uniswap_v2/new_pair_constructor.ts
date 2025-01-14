import { MultiCall } from "@indexed-finance/multicall";
//@inherit from uniswap_v3/new_pool_constructor.ts
import type { ethers } from "ethers";
import RedisGraph from "ioredisgraph";
import { QUERY_ADDR, routers } from "../../constant";
import { getSqrtWeightX96 } from "../uniswap_v3/edge_weight";
import { factories } from "../uniswap_v3/events";
import { default as BEP20 } from "./../../../abi/BEP20.json";
import { abi as ERC20 } from "./../../../abi/ERC20.json";
import { getPairData } from "./pair_states";

/**
 * @notice Constructs new pairs in the redis graph database.
 * @param graphName The name of the graph in Redis.
 * @param provider  The provider to use for the transaction.
 * @param addresses Set of addresses to process.
 * @param abi The ABI of the contract.
 * @param isBSC Boolean indicating if the network is Binance Smart Chain.
 */
export async function pairConstructor(
  graphName: string,
  provider: ethers.providers.JsonRpcProvider,
  addresses: Set<unknown>,
  abi: any,
  isBSC = false
) {
  // Convert the set of addresses to an array
  const addr = [...addresses];
  // Fetch pair data for the given addresses
  const pairsData = await getPairData(provider, addr, abi, true);

  // Initialize multicall for batch requests
  const multi: MultiCall = new MultiCall(provider);
  // Initialize RedisGraph client
  const client = new RedisGraph({
    graphName: graphName,
    port: 7024,
    host: process.env.HOST,
    username: "default",
    password: process.env.PASSWORD,
  });

  let addrIndex = -1;

  // Iterate over each pair data
  for (let i = 0; i < pairsData.length; i++) {
    // Extract unique token addresses from the pair data, filtering out router addresses
    const tokens = [...new Set(pairsData[i][1])]
      .filter(
        (item: any) =>
          typeof item === "string" && !Object.keys(routers).includes(item)
      )
      .map((token: string) => ({ target: token, function: "decimals" }), []);

    // Fetch decimals for each token using multicall
    const decimals = await multi.multiCall(isBSC ? BEP20 : ERC20, tokens);

    // Store token decimals in the graph database
    decimals[1].forEach(async (decimals: number, index: number) => {
      if (typeof decimals === "number")
        await client.query(
          `MERGE 
                        (t:Token 
                            {
                                id: '${tokens[index].target.toLowerCase()}', 
                                decimals: ${decimals}
                            }
                        )`
        );
    });

    // Iterate over each element in the pair data
    for (let j = 0; j < pairsData[i][1].length; j++) {
      // Skip if the element is a string
      if (typeof pairsData[i][1][j] === "string") continue;
      if (routers[pairsData[i][1][j + 3]] === undefined) {
        factories.add(pairsData[i][1][j + 3]);
        continue; //if that factory is not supported
      }
      addrIndex++;

      try {
        const reserve0 = pairsData[i][1][j].reserve0.toString();
        const reserve1 = pairsData[i][1][j].reserve1.toString();

        await client.query(
          `MATCH 
                        (token0:Token {id: '${pairsData[i][1][
                          j + 1
                        ].toLowerCase()}'}), 
                        (token1:Token {id: '${pairsData[i][1][
                          j + 2
                        ].toLowerCase()}'}) 
                    MERGE 
                        (token0)-[r0:reserve_zero]->(token1)-[r1:reserve_one]->(token0) 
                    SET 
                        r0.id ='${addr[addrIndex]}', 
                        r0.reserve0 = '${reserve0}', 
                        r0.reserve1 = '${reserve1}', 
                        r0.sqrtWeight = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 
                        r0.amount = '0', 
                        r0.zeroForOne = 1, 
                        r0.router = '${routers[pairsData[i][1][j + 3]]}', 

                        r1.id ='${addr[addrIndex]}', 
                        r1.reserve0 = '${reserve0}', 
                        r1.reserve1 = '${reserve1}', 
                        r1.sqrtWeight = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 
                        r1.amount = '0', 
                        r1.zeroForOne = 0, 
                        r1.router = '${routers[pairsData[i][1][j + 3]]}'`
        );

        const results = await client.query(
          `${QUERY_ADDR(
            addr[addrIndex] as string,
            "r",
            "reserve"
          )} RETURN token0.decimals, token1.decimals`
        );

        const data = getSqrtWeightX96(
          results[0]["token0.decimals"],
          results[0]["token1.decimals"],
          reserve0,
          reserve1
        );

        if (results[0]["token0.decimals"] === undefined) console.log(data);

        await client.query(
          `MATCH 
                        (token0)-[r0:reserve_zero {id:'${addr[addrIndex]}'}]->
                        (token1)-[r1:reserve_one {id:'${
                          addr[addrIndex]
                        }'}]->(token0) 
                    SET 
                        r0.sqrtWeight = '${data.sqrtWeight.toFixed(0)}', 
                        r0.amount = '${data.amount1.toString()}', 
    
                        r1.sqrtWeight = '${data.sqrtWeight.neg().toFixed(0)}', 
                        r1.amount = '${data.amount0.toString()}'`
        );
      } catch (err) {
        console.error(err.message);
      }
    }
  }
  await client.disconnect();
}
