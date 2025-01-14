// import { client } from "../../../constant"
// import { updatePoolState } from "../../uniswap_v3/pool_states"
// import { getEvents, createNewEdges } from "../../uniswap_v3/events"
// import { provider, providerWSS } from "./providers"
// import { SPFA } from "../../../algorithms/spfa"
// import { updatePairState } from "../../uniswap_v2/pair_states"
// import { abi as abiV3 } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"
// import { abi as abiV2 } from "@uniswap/v2-core/build/IUniswapV2Pair.json"


// export async function bscAtrium(graphName: string) {
//     const swapToken = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"

//     const [poolStates, pairReserves, rLen] = await Promise.all([
//         updatePoolState(graphName, provider, abiV3),
//         updatePairState(graphName, provider, abiV2),
//         client.readonlyQuery(`${graphName}`, `MATCH (:Token)-[r:reserve_zero]->(:Token) RETURN count(r)`)
//     ])
    
//     setTimeout(async () => {
//             providerWSS.on("block", async () => SPFA(graphName, 6, swapToken, provider))
//             createNewEdges(graphName, provider, abiV2, abiV3, true)
//     }, Number(rLen[1][0][0]) * 800)

//     getEvents(graphName, providerWSS, abiV2, abiV3)
// }