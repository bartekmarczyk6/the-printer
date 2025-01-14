// import "dotenv/config"
// import { MultiCall } from "@indexed-finance/multicall"
// import { provider } from "./network/polygon/providers"
// import { abi as abiV2 } from "@uniswap/v2-core/build/IUniswapV2Pair.json"
// import { pairConstructor } from "./uniswap_v2/new_pair_constructor"


// const abi = [{"inputs":[{"internalType":"address","name":"_feeToSetter","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token0","type":"address"},{"indexed":true,"internalType":"address","name":"token1","type":"address"},{"indexed":false,"internalType":"address","name":"pair","type":"address"},{"indexed":false,"internalType":"uint256","name":"","type":"uint256"}],"name":"PairCreated","type":"event"},{"constant":true,"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"allPairs","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"allPairsLength","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"}],"name":"createPair","outputs":[{"internalType":"address","name":"pair","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"feeTo","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"feeToSetter","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"getPair","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_feeTo","type":"address"}],"name":"setFeeTo","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_feeToSetter","type":"address"}],"name":"setFeeToSetter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]

// const addr: Set<string> = new Set()

// async function getAddresses(
//     addresses: number,
//     factoryAddress: string
// ) {
//     const multi: MultiCall = new MultiCall(provider)

//     for (let i = 0; i < addresses; i += 58) {
//         let part = []

//         for (let j = i; j < i + 58; j++) {
//             if (j == addresses) break

//             part.push(
//                 {target: factoryAddress, function: 'allPairs', args: [j]}
//             )
//         }

//         const response = await multi.multiCall(abi, part)
//         await checkReserves(response[1])
//     }
//     await pairConstructor("PolygonGraphV2", provider, addr, abiV2, false)
//         .catch(err => console.error("e|tCRT_V3 \n", err.message))
// } 

// getAddresses(252, "0x03DAa61d8007443a6584e3d8f85105096543C19c")

// async function checkReserves(
//     addresses: string[]
// ) {
//     const multi: MultiCall = new MultiCall(provider)

//     for (let i = 0; i < addresses.length; i += 55) {
//         let part = []

//         for (let j = i; j < i + 55; j++) {
//             if (addresses[j] == undefined) break

//             part.push(
//                 {target: addresses[j], function: 'getReserves'}
//             )
//         }
//         const reservesResponse = await multi.multiCall(abiV2, part)

//         for (let t = 0; t < reservesResponse[1].length; t++) {
//             if (reservesResponse[1][t]['reserve0'] > 1*10**18 && reservesResponse[1][t]['reserve1'] > 1*10**18)
//                 addr.add(part[t]['target'])
//         }
//     }
// }