import { Contract, Wallet, type ethers } from "ethers";
import "dotenv/config";
import { abi as flashRouterABI } from "../../artifacts/contracts/flashRouter.sol/FlashRouter.json";

/**
 * @notice Interface defining the structure of flash loan parameters.
 * @param flashLoanPool The address of the flash loan pool.
 * @param flashLoanAmount The amount of tokens to borrow in the flash loan.
 * @param path An object containing the tokens, fee tiers and routers for the transaction path.
 */
interface FlashLoanParams {
  flashLoanPool: string;
  flashLoanAmount: string;
  path: {
    tokens: string[];
    feeTiers: number[];
    routers: string[];
  };
}

/**
 * @notice Executes an arbitrage transaction using a flash loan.
 * @param _flashLoanPool The address of the flash loan pool.
 * @param _flashLoanAmount The amount of tokens to borrow in the flash loan.
 * @param _txPath An array containing the tokens and fee tiers for the transaction path.
 * @param _routers An array of router addresses for the transaction path.
 * @param provider An ethers provider instance.
 * @returns A Promise that resolves when the transaction is complete.
 */
export async function executeArbitrageTransaction(
  _flashLoanPool: string,
  _flashLoanAmount: bigint,
  _txPath: [string[], number[]],
  _routers: string[],
  provider: ethers.providers.JsonRpcProvider
): Promise<void> {
  // Contract address of the flash router
  const flashRouterAddress = "0xd2C407E66f052afe834647933ab81d482DF3A21A";
  // Create a signer from the private key and provider
  const signer: Wallet = new Wallet(
    process.env.PRIVATE_KEY as string,
    provider
  );
  // Create a contract instance of the flash router
  const flashRouter: Contract = new Contract(
    flashRouterAddress,
    flashRouterABI,
    signer
  );

  // Construct the parameters for the flash loan
  const params: FlashLoanParams = {
    flashLoanPool: _flashLoanPool,
    flashLoanAmount: _flashLoanAmount.toString(),
    path: {
      tokens: _txPath[0],
      feeTiers: _txPath[1],
      routers: _routers,
    },
  };

  console.log("Flash Loan Parameters:", params);

  try {
    // Execute the flash loan transaction
    const tx = await flashRouter.dodoFlashLoan([
      _flashLoanPool,
      _flashLoanAmount.toString(),
      [_txPath[0], _txPath[1], _routers],
    ]);
    // Wait for the transaction to be mined
    await tx.wait();
    console.log("Arbitrage transaction successful, transaction hash:", tx.hash);
  } catch (err: any) {
    console.error("Arbitrage transaction reverted:", err);
  }

  // Set a timeout to check the contract balance after a delay
  setTimeout(async () => {
    try {
      // Log the current stablecoin balance in the contract
      const stableCoinBalance = await flashRouter.getBalance(
        "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
      );
      console.log(
        "Current stablecoin value in contract:",
        stableCoinBalance.toString()
      );

      // Log the current MATIC balance in the contract
      const maticBalance = await flashRouter.getBalance(
        "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"
      );
      console.log("Current MATIC value in contract:", maticBalance.toString());
    } catch (err: any) {
      console.error("Error getting contract balance:", err);
    }
  }, 150000);
}
