const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv/config");
const {
  executeArbitrageTransaction,
} = require("../dist/printer_heart/loan/execute_loan.js");
const {
  provider,
} = require("../dist/printer_heart/dexes/network/polygon/providers.js");

// describe("FlashLoan", () => {
//     it("should execute flash loan transaction", async () => {
//         const flashRouter = await ethers.getContractFactory("FlashRouter")
//         const flashLoanContract = await flashRouter.deploy() //adresy do constructora
//         await flashLoanContract.deployed()

//         const flashLoanTx = async () => await flashLoanContract.dodoFlashLoan({
//             flashLoanPool: '0x5333Eb1E32522F1893B7C9feA3c263807A02d561',
//             flashLoanAmount: '16556516',
//             path: {
//               tokens: [
//                 '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
//                 '0x462d8d82c2b2d2ddabf7f8a93928de09d47a5807',
//                 '0x16eccfdbb4ee1a85a33f3a9b21175cd7ae753db4',
//                 '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
//                 '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39',
//                 '0x831753dd7087cac61ab5644b308642cc1c33dc13',
//                 '0x4c28f48448720e9000907bc2611f73022fdce1fa',
//                 '0x462d8d82c2b2d2ddabf7f8a93928de09d47a5807',
//                 '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'
//               ],
//               feeTiers: [
//                 0, 0, 0, 0,
//                 0, 0, 0, 0
//               ],
//               routers: [
//                 '0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429',
//                 '0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429',
//                 '0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429',
//                 '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
//                 '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
//                 '0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429',
//                 '0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429',
//                 '0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429'
//               ]
//             }
//           })
//         // await expect(
//             await flashLoanTx()
//         // ).to.be.revertedWith("Not enough amount to return loan");
//     })
// })

// Example usage of executeArbitrageTransaction function
// This function simulates an arbitrage transaction using a flash loan.
executeArbitrageTransaction(
  "0x5333Eb1E32522F1893B7C9feA3c263807A02d561", // The address of the flash loan pool.
  16556516n, // The amount of the flash loan.
  [
    [
      "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // Token addresses for the arbitrage path.
      "0x462d8d82c2b2d2ddabf7f8a93928de09d47a5807",
      "0x16eccfdbb4ee1a85a33f3a9b21175cd7ae753db4",
      "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
      "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39",
      "0x831753dd7087cac61ab5644b308642cc1c33dc13",
      "0x4c28f48448720e9000907bc2611f73022fdce1fa",
      "0x462d8d82c2b2d2ddabf7f8a93928de09d47a5807",
      "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
    ],
    [
      0,
      0,
      0,
      0, // Fee tiers for each hop in the arbitrage path.
      0,
      0,
      0,
      0,
    ],
  ],
  [
    "0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429", // Router addresses for each hop in the arbitrage path.
    "0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429",
    "0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429",
    "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    "0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429",
    "0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429",
    "0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429",
  ],
  provider // The provider to use for the transaction.
);
