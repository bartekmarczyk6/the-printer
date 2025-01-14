import { ethers } from "ethers"

export const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC)
export const providerWSS = new ethers.providers.WebSocketProvider(process.env.ETH_WSS)