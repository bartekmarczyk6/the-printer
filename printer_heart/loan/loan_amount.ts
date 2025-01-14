import type { ethers } from "ethers";
import { getInputAmount } from "../constant";
import type { EdgeInfo } from "../types/common";
import { flashLoanPools } from "./adresses";
import { executeArbitrageTransaction } from "./execute_loan";
import { getProfitAmount } from "./profit_amount";

/**
 * @notice Checks if a loan is possible and executes an arbitrage transaction if profitable.
 * @param edgePath An array of EdgeInfo objects representing the path of the arbitrage.
 * @param tokenPath An array of token addresses representing the path of the arbitrage.
 * @param provider An ethers provider instance.
 */
export function checkLoanPossibility(
  edgePath: EdgeInfo[],
  tokenPath: string[],
  provider: ethers.providers.JsonRpcProvider
): void {
  // Calculate the loan amount based on the provided path
  const loanAmount: bigint = getLoanAmount(edgePath);
  // Calculate the potential profit amount based on the provided path and loan amount
  const profitAmount: bigint = getProfitAmount(edgePath, loanAmount);
  // Calculate the profit by subtracting the loan amount from the profit amount
  const profitFormula: bigint = profitAmount - loanAmount;

  // Check if the profit is greater than zero
  if (profitFormula > 0n) {
    // Extract the router addresses from the edge path and reverse the order
    const routers: string[] = edgePath
      .map((edgeInfo) => edgeInfo.router)
      .reverse();
    // Extract the fee tiers from the edge path and reverse the order
    const feeTierPath: number[] = edgePath
      .map((elm) => elm.feeTier ?? 0)
      .reverse();

    // Execute the arbitrage transaction with the calculated parameters
    executeArbitrageTransaction(
      flashLoanPools[tokenPath[0]],
      loanAmount,
      [tokenPath, feeTierPath],
      routers,
      provider
    );
  }
}

/**
 * @notice Calculates the loan amount based on the provided path.
 * @param path An array of EdgeInfo objects representing the path of the arbitrage.
 * @returns The calculated loan amount.
 */
export function getLoanAmount(path: EdgeInfo[]): bigint {
  // Initialize the loan amount with the amount from the first edge
  let loanAmount: bigint = BigInt(path[0].amount);

  // Iterate over the edges in the path
  for (let i = 0; i < path.length; i++) {
    // Check if the current edge has a tick value
    if (path[i].tick !== null) {
      // If it has a tick, calculate the loan amount based on the tick
      loanAmount = calculateTickBasedAmount(path[i], loanAmount);
    } else {
      // If it doesn't have a tick, calculate the loan amount based on the reserves
      loanAmount = getInputAmount(
        BigInt(path[i].reserve0),
        BigInt(path[i].reserve1),
        loanAmount,
        path[i].zeroForOne
      );
    }

    // Check if it's not the last edge and if the current loan amount is greater than the next edge's amount
    if (i !== path.length - 1 && loanAmount > BigInt(path[i + 1].amount)) {
      // If it is, set the loan amount to the next edge's amount
      loanAmount = BigInt(path[i + 1].amount);
    }
  }
  // Return the final calculated loan amount
  return loanAmount;
}

/**
 * @notice Calculates the loan amount based on the tick value.
 * @param edge An EdgeInfo object representing the current edge.
 * @param loanAmount The current loan amount.
 * @returns The calculated loan amount based on the tick.
 */
function calculateTickBasedAmount(edge: EdgeInfo, loanAmount: bigint): bigint {
  // Get the tick value from the edge
  const tick: number = edge.tick as number;

  // Check if the tick is positive and zeroForOne is true
  if (tick > 0 && edge.zeroForOne) {
    // If it is, calculate the loan amount based on the tick and return it
    return BigInt(Math.round(1.0001 ** tick)) * loanAmount;
  }
  // Check if the tick is positive
  if (tick > 0) {
    // If it is, calculate the loan amount based on the tick and return it
    return loanAmount / BigInt(Math.round(1.0001 ** tick));
  }
  // Check if zeroForOne is true
  if (edge.zeroForOne) {
    // If it is, calculate the loan amount based on the tick and return it
    return BigInt(Math.round(1.0001 ** tick * Number(loanAmount)));
  }
  // If none of the above conditions are met, calculate the loan amount based on the absolute value of the tick and return it
  return BigInt(Math.round(1.0001 ** Math.abs(tick))) * loanAmount;
}
