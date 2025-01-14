import { ethers } from "ethers"

export const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC)
export const providerWSS = new ethers.providers.WebSocketProvider(process.env.POLYGON_WSS)