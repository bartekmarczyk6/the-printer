import "dotenv/config";
import cluster from "node:cluster";
import os from "node:os";
import process from "node:process";
import { client } from "./constant";
import { polygonAtrium } from "./dexes/network/polygon/heart_part";
import type { NetworkOperation } from "./types/common";

/**
 * Initializes the Redis client by connecting to the Redis server.
 * If the connection fails, it logs an error and exits the process.
 */
async function initializeClient(): Promise<void> {
  try {
    await client.connect();
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    process.exit(1);
  }
}

/**
 * Creates chunks of network operations based on the specified chunk size.
 * @param operations An array of network operations to be chunked.
 * @param chunkSize The desired size of each chunk.
 * @returns A 2D array of network operations, where each inner array is a chunk.
 */
function createOperationChunks(
  operations: NetworkOperation[],
  chunkSize: number
): NetworkOperation[][] {
  const chunks: NetworkOperation[][] = [];
  for (let i = 0; i < operations.length; i += chunkSize) {
    const chunk = operations.slice(i, i + chunkSize);
    chunks.push(chunk);
  }
  return chunks;
}

/**
 * Executes network operations for a worker process.
 * It maps each operation to the `polygonAtrium` function and waits for all operations to complete.
 * If any operation fails, it logs an error and exits the process.
 * @param operations An array of network operations to be executed.
 */
async function executeWorkerOperations(
  operations: NetworkOperation[]
): Promise<void> {
  try {
    await Promise.all(
      operations.map((operation) => polygonAtrium(operation.graphName))
    );
    process.exit(0);
  } catch (error) {
    console.error("Worker execution failed:", error);
    process.exit(1);
  }
}

/**
 * The main function of the application.
 * It initializes the Redis client and then either runs in single-instance mode or multi-instance mode based on the cluster configuration.
 */
async function main(): Promise<void> {
  await initializeClient();

  // Uncomment to enable multi-instance processing
  /*
  const instances = os.cpus().length;
  const operations: NetworkOperation[] = [
    // Add network operations here
    { graphName: "PolygonGraph" }
  ];
  
  const chunks = createOperationChunks(operations, Math.ceil(operations.length / instances));

  if (cluster.isPrimary) {
    for (let i = 0; i < instances; ++i) {
      cluster.fork();
    }
  } else if (cluster.isWorker && cluster.worker) {
    await executeWorkerOperations(chunks[cluster.worker.id - 1]);
  }
  */

  // Single instance mode
  await polygonAtrium("PolygonGraph");
}

// Start the application
main().catch((error) => {
  console.error("Application failed to start:", error);
  process.exit(1);
});
