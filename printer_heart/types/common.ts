import type { ethers } from "ethers";

export interface EdgeInfo {
  amount: string;
  reserve0: string;
  reserve1: string;
  tick: number | null;
  feeTier: number | undefined;
  zeroForOne: boolean;
  router: string;
}

export interface TokenPath {
  tokens: string[];
  feeTiers: number[];
  routers: string[];
}

export interface EdgePath {
  path: EdgeInfo[];
  tokenPath: string[];
}

export interface GraphResponse {
  token0: {
    decimals: number;
    id: string;
  };
  token1: {
    decimals: number;
    id: string;
  };
}

export interface GraphEdge {
  id: string;
  sqrtWeight: string;
  token0: number;
  token1: number;
}

export interface GraphVertex {
  id: number;
  tokenId: string;
}

export interface SPFAResult {
  path: EdgeInfo[];
  tokenPath: string[];
}

export interface GraphQueryResult {
  beforeSwap: string;
  afterSwap: string;
  tokenId: string;
}

export interface EdgeQueryResult {
  amount: string;
  reserve0: string;
  reserve1: string;
  tick: number;
  feeTier: number;
  zeroForOne: boolean;
  router: string;
}

export interface RedisGraphResponse<T> {
  0: number;
  1: T[];
}

export interface NetworkOperation {
  graphName: string;
  provider: ethers.providers.JsonRpcProvider;
  providerWSS: ethers.providers.WebSocketProvider;
}

export interface ChunkOperation {
  operations: NetworkOperation[];
  chunkSize: number;
}

export interface RouterMapping {
  [key: string]: string;
}

export interface TermTickSpacing {
  [key: number]: number;
}

export interface SqrtPriceCalcParams {
  sqrtPX96: bigint;
  liquidity: bigint;
  amount: bigint | string;
  zeroForOne: boolean;
}

export interface AmountDeltaParams {
  sqrtRatioAX96: bigint;
  sqrtRatioBX96: bigint;
  liquidity: bigint;
  roundUp: boolean;
}

export interface RedisGraphConfig {
  port: number;
  host: string | undefined;
  username: string;
  password: string | undefined;
}

export interface MathOperations {
  mulDivRoundingUp: (a: bigint, b: bigint, denominator: bigint) => bigint;
  getSqrtRatio: (
    tick: number,
    tickSpacing: number,
    lowerTick: boolean
  ) => bigint;
  getAmount0Delta: (
    sqrtPX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
    roundUp: boolean
  ) => bigint | undefined;
  getAmount1Delta: (
    sqrtRatioAX96: bigint,
    sqrtPX96: bigint,
    liquidity: bigint,
    roundUp: boolean
  ) => bigint | undefined;
}

export interface PriceCalculations {
  getNextSqrtPriceFromOutput: (
    sqrtPX96: bigint,
    liquidity: bigint,
    amountOut: bigint | string,
    zeroForOne: boolean
  ) => bigint;
  getNextSqrtPriceFromInput: (
    sqrtPX96: bigint,
    liquidity: bigint,
    amountIn: bigint | string,
    zeroForOne: boolean
  ) => bigint;
}
