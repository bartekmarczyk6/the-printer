import { getOutputAmount } from "../constant";
import type { EdgeInfo } from "../types/common";

/**
 * @notice Calculates the potential profit amount based on a given path and initial loan amount.
 * @param path An array of EdgeInfo objects representing the path of the arbitrage.
 * @param loanAmount The initial loan amount.
 * @returns The calculated profit amount.
 */
export function getProfitAmount(path: EdgeInfo[], loanAmount: bigint): bigint {
  let profit: bigint = loanAmount;

  // Iterate backwards through the path to calculate profit at each step
  for (let i = path.length - 1; i >= 0; i--) {
    // If the edge has a tick, calculate profit based on the tick
    if (path[i].tick !== null) {
      profit = calculateTickBasedProfit(path[i], profit);
    } else {
      // If no tick, calculate profit based on reserves
      profit = getOutputAmount(
        BigInt(path[i].reserve0),
        BigInt(path[i].reserve1),
        profit,
        path[i].zeroForOne
      );
    }
  }
  return profit;
}

/**
 * @notice Calculates the profit amount based on the tick value.
 * @param edge An EdgeInfo object representing the current edge.
 * @param currentProfit The current profit amount.
 * @returns The calculated profit amount based on the tick.
 */
function calculateTickBasedProfit(
  edge: EdgeInfo,
  currentProfit: bigint
): bigint {
  // Get the tick value from the edge
  const tick: number = edge.tick as number;
  // Get the fee tier from the edge, default to 0 if not present
  const feeTier: bigint = BigInt(edge.feeTier ?? 0);
  // Calculate the fee multiplier
  const feeMultiplier: bigint = (1000000n - feeTier) / 1000000n;
  // Calculate the price impact based on the tick
  const priceImpact: number = 1.0001 ** tick;

  // Check if the tick is positive and zeroForOne is true
  if (tick > 0 && edge.zeroForOne) {
    // If it is, calculate the profit based on the tick, current profit and fee multiplier
    return BigInt(Math.round(priceImpact)) * currentProfit * feeMultiplier;
  }
  // Check if the tick is positive
  if (tick > 0) {
    // If it is, calculate the profit based on the tick, current profit and fee multiplier
    return (currentProfit * feeMultiplier) / BigInt(Math.round(priceImpact));
  }
  // Check if zeroForOne is true
  if (edge.zeroForOne) {
    // If it is, calculate the profit based on the tick, current profit and fee multiplier
    return BigInt(
      Math.round(priceImpact * Number(currentProfit) * Number(feeMultiplier))
    );
  }
  // If none of the above conditions are met, calculate the profit based on the absolute value of the tick, current profit and fee multiplier
  return (
    BigInt(Math.round(1.0001 ** Math.abs(tick))) * currentProfit * feeMultiplier
  );
}
