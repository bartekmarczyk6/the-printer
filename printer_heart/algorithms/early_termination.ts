import type { ethers } from "ethers";
import { checkLoanPossibility } from "../loan/loan_amount";
import type { EdgeInfo, EdgePath, TokenPath } from "../types/common";

/**
 * Finds a sub-path within a given edge path that represents an arbitrage opportunity.
 *
 * @param edgePath - An array of EdgeInfo representing the path of edges.
 * @param edgeInfo - An array of EdgeInfo, typically the same as edgePath, used for slicing.
 * @returns An array of EdgeInfo representing the arbitrage sub-path, or the original edgeInfo if no arbitrage is found.
 */
export function createArbPath(
  edgePath: EdgeInfo[],
  edgeInfo: EdgeInfo[]
): EdgeInfo[] {
  // Iterate backwards through the edgePath
  for (let i = edgePath.length - 1; i > 0; i--) {
    // Iterate from the start to the current index i
    for (let j = 0; j < i; j++) {
      // Check if an arbitrage opportunity exists:
      // if the 'to' of edge j is equal to the 'from' of edge i, and the distance between i and j is greater than 1
      if (edgePath[j][1] === edgePath[i][2] && i - j > 1) {
        // Return the sub-path representing the arbitrage opportunity
        return edgeInfo.slice(j, i + 1);
      }
    }
  }
  // If no arbitrage opportunity is found, return the original edgeInfo
  return edgeInfo;
}

/**
 * Performs early termination logic for arbitrage detection.
 *
 * @param edgePath - An object containing the path of edges.
 * @param txPath - An object containing the path of tokens.
 * @param swapToken - The address of the swap token.
 * @param provider - An ethers.js provider for interacting with the blockchain.
 * @param maxHops - The maximum number of hops allowed in the path.
 */
export function earlyTermination(
  edgePath: EdgePath,
  txPath: TokenPath,
  swapToken: string,
  provider: ethers.providers.JsonRpcProvider,
  maxHops: number
): void {
  // Attempt to find an arbitrage sub-path within the given edge path
  const cutValues = createArbPath(edgePath.path, edgePath.path);
  // If a shorter arbitrage sub-path is found
  if (cutValues.length < edgePath.path.length) {
    // Check the loan possibility for the identified arbitrage sub-path
    checkLoanPossibility(cutValues, txPath.tokens, provider);
  }
}
