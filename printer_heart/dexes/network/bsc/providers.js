import { ethers } from "ethers"

export const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC)
export const providerWSS = new ethers.providers.WebSocketProvider(process.env.BSC_WSS)