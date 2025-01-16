# The Printer - Cryptocurrency Arbitrage System

Disclaimer:
This project was created in 2021 as a first serious project for learning programming. It may be incomplete or some parts may not function correctly. However, it aims to showcase a creative approach to arbitrage strategies in the crypto space. This project is for educational purposes only and should not be used for any financial gain.

## 1. Project Overview

### Purpose

The "Printer" project is an advanced cryptocurrency arbitrage system that utilizes flash loans to execute arbitrage transactions across various DEXs (Decentralized Exchanges).

### Arbitrage Opportunity Detection

The core of the arbitrage detection mechanism lies within the `printer_heart/algorithms/spfa.ts` file, which implements the Shortest Path Faster Algorithm (SPFA). This algorithm is used to find negative cycles in a graph representing DEX liquidity pools. Each node in the graph represents a token, and each edge represents a swap between two tokens on a specific DEX. The weight of an edge is the negative logarithm of the swap price, so a negative cycle indicates an arbitrage opportunity.

The `SPFA` function takes a graph name, a list of starting vertices (tokens), and a provider as input. It queries the Redis Graph database to retrieve the edges and vertices of the graph. It then initializes distances and predecessors for each vertex. The algorithm iterates through all edges, updating distances and predecessors if a shorter path is found. After the main loop, it checks for negative cycles. If a negative cycle is detected, it constructs the arbitrage path by traversing the predecessors. It then queries the database for additional information about the edges in the path, such as amounts, reserves, and fee tiers. Finally, it calls the `checkLoanPossibility` function from `printer_heart/loan/loan_amount.ts` to check if the arbitrage opportunity is profitable and execute the flash loan transaction.

### Early Termination

The `printer_heart/algorithms/early_termination.ts` file implements an early termination optimization. The `createArbPath` function identifies if there is a cycle in the path and returns the shortest path. The `earlyTermination` function takes an edge path, a token path, a swap token, a provider, and a maximum number of hops as input. It calls `createArbPath` to check if there is a cycle in the path. If a cycle is found, it calls the `checkLoanPossibility` function with the shortened path. This optimization prevents the algorithm from exploring longer paths that contain cycles, which are not profitable.

### Core Features

- Flash loan execution through DODO protocol
- Arbitrage between different DEXs (Uniswap V2 and V3)
- Automatic arbitrage opportunity detection
- Multi-network management (Polygon, BSC)
- Wallet and transaction monitoring

### Main Components

- FlashRouter Contract (`contracts/flashRouter.sol`) - Smart contract managing flash loans and swaps
- Printer Heart (`printer_heart/`) - Main application engine handling business logic
- Loan Module (`printer_heart/loan/`) - Module responsible for flash loan calculations and execution

## 2. Technical Architecture

### Technology Stack

```text
- Solidity ^0.8.0
- TypeScript/JavaScript
- Hardhat
- Ethers.js
- Redis Graph
- Node.js
```

### Integrations

- DODO Protocol (flash loans)
- Uniswap V2 & V3
- Polygon Network
- BSC Network

## 3. Requirements and Installation

### System Requirements

- Node.js
- Redis with RedisGraph support
- Access to blockchain nodes (Polygon, BSC)

## 4. Usage Instructions

[Installation and usage instructions would go here]

## 5. Development and Testing

Test files are located in the `test/` directory and include flash loan transaction examples.

## 6. Deployment

### FlashRouter Contract Deployment Instructions

1.  **Prerequisites:**
    *   Ensure you have Hardhat installed and configured for your desired network (e.g., Polygon, BSC).
    *   Make sure you have the necessary environment variables set up, such as your private key and RPC endpoint.

2.  **Deployment Script:**
    *   The project includes a deployment script located at `scripts/flash_loan.mjs`. This script compiles and deploys the `FlashRouter` contract.
    *   **Note:** This script currently deploys the contract without constructor arguments. You will need to modify it to include the addresses of the Uniswap V3 and V2 routers.

3.  **Deploy the Contract:**
    *   Run the deployment script using Hardhat:
        ```bash
        npx hardhat run scripts/flash_loan.mjs --network <your_network_name>
        ```
        *   Replace `<your_network_name>` with the name of the network you want to deploy to (e.g., `polygon`, `bsc`).

4.  **Verification (Optional):**
    *   After successful deployment, you can verify the contract on the block explorer using Hardhat's verification plugin.
    *   Refer to the Hardhat documentation for instructions on how to verify contracts.

5.  **Post-Deployment:**
    *   Record the deployed contract address.
    *   You can now interact with the deployed `FlashRouter` contract using its ABI and address.

## 7. Security

The project implements:

- OpenZeppelin for secure smart contract implementations
- ReentrancyGuard for protection against reentrancy attacks
- SafeERC20 for secure ERC20 token handling
