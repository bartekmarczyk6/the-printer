// import { provider, providerWSS } from "./providers"
// import { updatePoolState } from "../../uniswap_v3/pool_states"
// import { getEvents } from "../../uniswap_v3/events"
// import { abi } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"
// import "dotenv/config"


// export async function uniV3EthereumAtrium(graphName: string) {
//     const swapToken = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"

//     await updatePoolState(graphName, provider, abi)
//         .then(() => getEvents(graphName, provider, providerWSS, swapToken, true, 5, abi))
// }