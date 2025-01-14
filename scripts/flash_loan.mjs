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
