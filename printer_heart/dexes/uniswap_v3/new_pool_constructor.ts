import { MultiCall } from "@indexed-finance/multicall";
import type { ethers } from "ethers";
import RedisGraph from "ioredisgraph";
import { QUERY_ADDR, getSqrtRatio, tierToSpacing } from "../../constant";
import BEP20_ABI from "./../../../abi/BEP20.json";
import ERC20_ABI from "./../../../abi/ERC20.json";
import { getSqrtWeightX96 } from "./edge_weight";
import { getPoolData } from "./pool_states";

interface TokenData {
  target: string;
  function: string;
}

type RedisQueryResult = {
  [key: string]: number;
}[];

export async function poolConstructor(
  graphName: string,
  provider: ethers.providers.JsonRpcProvider,
  addresses: Set<string>,
  abi: any,
  isBSC = false
) {
  // Convert the set of addresses to an array
  const addr = [...addresses];
  // Fetch pool data
  const poolsData = await getPoolData(provider, addr, abi, true);

  // Initialize multicall
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

  // Iterate over each pool
  for (let i = 0; i < poolsData.length; i++) {
    // Extract token addresses and prepare for multicall
    const tokens: TokenData[] = [...new Set(poolsData[i][1])]
      .filter((item): item is string => typeof item === "string")
      .map((token) => ({ target: token, function: "decimals" }));

    // Fetch decimals for each token
    const decimals: any = await multi.multiCall(
      isBSC ? BEP20_ABI : ERC20_ABI,
      tokens
    );

    // Store token decimals in the graph
    await Promise.all(
      decimals[1].map(async (decimal, index) => {
        await client.query(
          `MERGE 
                (t:Token 
                    {
                        id: '${tokens[index].target.toLowerCase()}', 
                        decimals: ${decimal}
                    }
                )`
        );
      })
    );

    // Iterate over the pool's state data
    for (let j = 0; j < poolsData[i][1].length; j += 5) {
      // Skip if liquidity is zero
      if (poolsData[i][1][j].toString() === "0") continue;
      addrIndex++;

      // Create or update the state edges in the graph
      await client.query(
        `MATCH 
                    (token0:Token {id: '${poolsData[i][1][
                      j + 3
                    ].toLowerCase()}'}), 
                    (token1:Token {id: '${poolsData[i][1][
                      j + 4
                    ].toLowerCase()}'}) 
                MERGE 
                    (token0)-[st0:state_zero {id: '${addr[addrIndex]}'}]->
                    (token1)-[st1:state_one {id: '${
                      addr[addrIndex]
                    }'}]->(token0) 
                SET 
                    st0.liquidity = '${poolsData[i][1][j].toString()}', 
                    st0.sqrtPrice = '${poolsData[i][1][
                      j + 1
                    ].sqrtPriceX96.toString()}', 
                    st0.tick = ${poolsData[i][1][j + 1].tick}, 
                    st0.tickSpacing = ${tierToSpacing(poolsData[i][1][j + 2])}, 
                    st0.sqrtWeight = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 
                    st0.amount = '0', 
                    st0.feeTier = ${poolsData[i][1][j + 2]}, 
                    st0.zeroForOne = 1, 
                    st0.router = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', 

                    st1.tick = ${poolsData[i][1][j + 1].tick}, 
                    st1.sqrtWeight = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 
                    st1.amount = '0', 
                    st1.feeTier = ${poolsData[i][1][j + 2]}, 
                    st1.zeroForOne = 0, 
                    st1.router = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'`
      );

      // Fetch token decimals for weight calculation
      const results: RedisQueryResult = await client.query(
        `${QUERY_ADDR(addr[addrIndex])} RETURN token0.decimals, token1.decimals`
      );

      // Calculate sqrt ratios
      const sqrtRatioAX96 = getSqrtRatio(
        poolsData[i][1][j + 1].tick,
        tierToSpacing(poolsData[i][1][j + 2]),
        true
      );
      const sqrtRatioBX96 = getSqrtRatio(
        poolsData[i][1][j + 1].tick,
        tierToSpacing(poolsData[i][1][j + 2]),
        false
      );

      // Calculate sqrt weights and amounts
      const data = getSqrtWeightX96(
        results[0]["token0.decimals"],
        results[0]["token1.decimals"],
        undefined,
        undefined,
        BigInt(poolsData[i][1][j + 1].sqrtPriceX96.toString()),
        sqrtRatioAX96,
        sqrtRatioBX96,
        BigInt(poolsData[i][1][j].toString()),
        poolsData[i][1][j + 2]
      );

      // Update the state edges with calculated weights and amounts
      await client.query(
        `MATCH 
                    (token0)-[st0:state_zero {id:'${addr[addrIndex]}'}]->
                    (token1)-[st1:state_one {id:'${
                      addr[addrIndex]
                    }'}]->(token0) 
                SET 
                    st0.sqrtWeight = '${data.sqrtWeight.toFixed(0)}', 
                    st0.amount = '${data.amount1.toString()}', 

                    st1.sqrtWeight = '${data.sqrtWeight.neg().toFixed(0)}', 
                    st1.amount = '${data.amount0.toString()}'`
      );
    }
  }
  // Disconnect from the RedisGraph client
  await client.disconnect();
}
