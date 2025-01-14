import { ethers, utils } from "ethers";
import { SPFA } from "../../algorithms/spfa";
import {
  QUERY_ADDR,
  addresses,
  client,
  getNextSqrtPriceFromInput,
  getNextSqrtPriceFromOutput,
} from "../../constant";
import { createPairs } from "../uniswap_v2/events";
import { updateGraphbySync } from "../uniswap_v2/events";
import { pairConstructor } from "../uniswap_v2/new_pair_constructor";
import { updateSingleSqrtWeight } from "./edge_weight";
import { poolConstructor } from "./new_pool_constructor";

interface BlockchainLogs {
  address?: string;
  blockNumber?: number;
  transactionHash?: string;
  topics: string[];
  data: string;
}

const createPools: Set<string> = new Set();
export const factories = new Set();

/**
 * Updates liquidity and sqrtPrice based on Mint or Burn events.
 * @param graphName The name of the graph.
 * @param type The type of event ('Mint' or 'Burn').
 * @param address The address of the pool.
 * @param amount The amount of liquidity changed.
 * @returns A tuple containing the new liquidity and sqrtPrice.
 */
async function updateByMintBurnEvent(
  graphName: string,
  type: "Mint" | "Burn",
  address: string,
  amount: string
): Promise<[bigint, bigint]> {
  const res = await client
    .query(
      `${graphName}`,
      `${QUERY_ADDR(address)} RETURN st0.liquidity, st0.sqrtPrice`
    )
    .catch((err) => {
      console.error("dGET_V3 \n", err.message);
      throw err; // re-throw the error to prevent further execution
    });

  const currentLiquidity = BigInt(res[1][0][0]);
  const sqrtPrice = BigInt(res[1][0][1]);

  const liquidity =
    type === "Mint"
      ? currentLiquidity + BigInt(amount)
      : currentLiquidity - BigInt(amount);

  return [liquidity, sqrtPrice];
}

/**
 * Fetches and processes events from Uniswap V3 and V2.
 * @param graphName The name of the graph.
 * @param provider An ethers JsonRpcProvider.
 * @param providerWSS An ethers WebSocketProvider.
 * @param swapToken The swap token address.
 * @param startVertices An array of start vertices for SPFA.
 * @param maxHops The maximum number of hops for SPFA.
 * @param abiV2 The ABI for Uniswap V2.
 * @param abiV3 The ABI for Uniswap V3.
 * @param isBSC Boolean indicating if it's on Binance Smart Chain.
 */
export async function getEvents(
  graphName: string,
  provider: ethers.providers.JsonRpcProvider,
  providerWSS: ethers.providers.WebSocketProvider,
  swapToken: string,
  startVertices: number[],
  maxHops: number,
  abiV2: any,
  abiV3: any,
  isBSC = false
) {
  const ifaceV2 = new ethers.utils.Interface(abiV2);
  const ifaceV3 = new ethers.utils.Interface(abiV3);

  const filter = [
    [
      utils.id("Swap(address,address,int256,int256,uint160,uint128,int24)"),
      utils.id("Mint(address,address,int24,int24,uint128,uint256,uint256)"),
      utils.id("Burn(address,int24,int24,uint128,uint256,uint256)"),
    ],
    null,
  ];

  const filterV2 = [
    [
      utils.id("Sync(uint112,uint112)"),
      utils.id("Swap(address,uint256,uint256,uint256,uint256,address)"),
    ],
    null,
  ];

  const addrs = await addresses(graphName);
  const addr = [...new Set(addrs[1].flat())];

  let currentBlockEvents: any[] = [];

  providerWSS.on("block", async () => {
    if (currentBlockEvents.length > 0) {
      for (const event of currentBlockEvents) {
        try {
          if (filterV2[0].includes(event.topic)) {
            await updateGraphbySync(graphName, addr, event);
          } else {
            await updateGraphbyEvent(graphName, addr, event);
          }
        } catch (err) {
          console.error("dGET_V3 \n", (err as Error).message);
        }
      }
      SPFA(graphName, startVertices, provider);
    }
    currentBlockEvents = [];
  });

  providerWSS.on(filter, (log: BlockchainLogs) => {
    if (!log.address) return;
    const poolData = ifaceV3.parseLog(log);

    const stateEvent = {
      address: log.address.toLowerCase(),
      type: poolData.name,
      liquidity: poolData.args.liquidity as bigint,
      tick: poolData.args.tick as number,
      sqrtPrice: poolData.args.sqrtPriceX96 as bigint,
      modifiedAmount: poolData.args.amount as string,
      amount0: poolData.args.amount0,
      amount1: poolData.args.amount1,
    };
    currentBlockEvents.push(stateEvent);
  });

  providerWSS.on(filterV2, (log: BlockchainLogs) => {
    if (!log.address) return;
    const pairData = ifaceV2.parseLog(log);

    const stateEvent = {
      address: log.address.toLowerCase(),
      type: pairData.name,
      topic: pairData.topic,
      reserve0: pairData.args.reserve0,
      reserve1: pairData.args.reserve1,
    };
    currentBlockEvents.push(stateEvent);
  });

  setInterval(async () => {
    if (createPools.size > 0) {
      addr.push(...createPools);
      await poolConstructor(
        graphName,
        provider,
        createPools,
        abiV3,
        isBSC
      ).catch((err) => console.error("e|tCRT_V3 \n", (err as Error).message));
      createPools.clear();
    }

    if (createPairs.size > 0) {
      addr.push(...createPairs);
      await pairConstructor(
        graphName,
        provider,
        createPairs,
        abiV2,
        isBSC
      ).catch((err) => console.error("e|tCRT_V2 \n", (err as Error).message));
      createPools.clear();
    }
  }, 60000);

  /**
   * Updates the graph database based on a Uniswap V3 event.
   * @param graphName The name of the graph.
   * @param addresses An array of addresses.
   * @param stateEvent The event data.
   */
  async function updateGraphbyEvent(
    graphName: string,
    addresses: string[],
    stateEvent: {
      address: string;
      type: string;
      liquidity?: bigint;
      tick?: number;
      sqrtPrice?: bigint;
      modifiedAmount?: string;
      amount0?: bigint;
      amount1?: bigint;
    }
  ) {
    const isAddressExisting = new Set(addresses).has(stateEvent.address);
    if (isAddressExisting) {
      if (stateEvent.type === "Swap") {
        await Promise.all([
          client.query(
            `${graphName}`,
            `MATCH 
                            (token0:Token)-[st0:state_zero {id: '${
                              stateEvent.address
                            }'}]->
                            (token1:Token)-[st1:state_one {id: '${
                              stateEvent.address
                            }'}]->(token0:Token) 
                        SET 
                            st0.liquidity = '${stateEvent.liquidity?.toString()}', 
                            st1.liquidity = '${stateEvent.liquidity?.toString()}', 
                            st0.tick = ${stateEvent.tick}, 
                            st0.sqrtPrice = '${stateEvent.sqrtPrice?.toString()}', 
                            st1.sqrtPrice = '${stateEvent.sqrtPrice?.toString()}'`
          ),
          updateSingleSqrtWeight(graphName, stateEvent.address),
        ]).catch((err) => console.error("sUPDT_V3 \n", (err as Error).message));
      } else {
        if (!stateEvent.modifiedAmount) return;
        const state = await updateByMintBurnEvent(
          graphName,
          stateEvent.type as "Mint" | "Burn",
          stateEvent.address,
          stateEvent.modifiedAmount
        );

        let sqrtPrice: bigint | boolean;

        if (stateEvent.type === "Mint") {
          sqrtPrice =
            stateEvent.amount0 !== 0n &&
            getNextSqrtPriceFromInput(
              state[1],
              state[0],
              stateEvent.amount0,
              true
            );

          sqrtPrice =
            stateEvent.amount0 !== 0n && stateEvent.amount1?.toString() !== "0"
              ? getNextSqrtPriceFromInput(
                  sqrtPrice as bigint,
                  state[0],
                  stateEvent.amount1,
                  false
                )
              : stateEvent.amount1 !== 0n &&
                getNextSqrtPriceFromInput(
                  state[1],
                  state[0],
                  stateEvent.amount1,
                  false
                );
        } else {
          sqrtPrice =
            stateEvent.amount0 !== 0n &&
            getNextSqrtPriceFromOutput(
              state[1],
              state[0],
              stateEvent.amount0,
              true
            );

          sqrtPrice =
            stateEvent.amount0 !== 0n && stateEvent.amount1 !== 0n
              ? getNextSqrtPriceFromOutput(
                  sqrtPrice as bigint,
                  state[0],
                  stateEvent.amount1,
                  false
                )
              : stateEvent.amount1 !== 0n &&
                getNextSqrtPriceFromOutput(
                  state[1],
                  state[0],
                  stateEvent.amount1,
                  false
                );
        }

        await client
          .query(
            `${graphName}`,
            `MATCH 
                        (token0:Token)-[st0:state_zero {id: '${
                          stateEvent.address
                        }'}]->
                        (token1:Token)-[st1:state_one {id: '${
                          stateEvent.address
                        }'}]->(token0:Token) 
                    SET 
                        st0.liquidity = '${state[0].toString()}', 
                        st0.sqrtPrice = '${
                          typeof sqrtPrice === "bigint"
                            ? sqrtPrice.toString()
                            : state[1].toString()
                        }', 

                        st1.liquidity = '${state[0].toString()}', 
                        st1.sqrtPrice = '${
                          typeof sqrtPrice === "bigint"
                            ? sqrtPrice.toString()
                            : state[1].toString()
                        }'`
          )
          .then(() => updateSingleSqrtWeight(graphName, stateEvent.address))
          .catch((err) => console.error("sUPDT_V3 \n", (err as Error).message));
      }
    } else {
      createPools.add(stateEvent.address);
    }
  }
}
