import { Contract } from "ethers";
import hre from "hardhat";

/**
 * @notice Main function to deploy the FlashRouter contract.
 * @dev This script compiles the contract and deploys it to the network specified in hardhat config.
 */
async function main() {
  // Compile the contract
  await hre.run("compile");

  // Get the contract factory for FlashRouter
  const flashRouterFactory = await hre.ethers.getContractFactory("FlashRouter");

  const uniswapV3RouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // Polygon mainnet
  const uniswapV2RouterAddress = "0xedf6066a2b290C185783862C7F4776A2C8077AD1"; // Polygon mainnet

  // Deploy the contract
  const flashLoanContract = await flashRouterFactory.deploy();

  // Wait for the contract to be deployed
  await flashLoanContract.deployed();

  // Log the contract address
  console.log(`FlashLoan contract address: ${flashLoanContract.address}`);
}

// Execute the main function and handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
