import type { ethers } from "ethers";
import { client } from "../constant";
import { checkLoanPossibility } from "../loan/loan_amount";
import type { EdgeInfo, RedisGraphResponse, TokenPath } from "../types/common";

// Define the structure of an edge
interface Edge {
  from: number;
  to: number;
  sqrtWeight: string;
  id: string;
}

// Define the structure of a vertex
interface Vertex {
  id: number;
  tokenId: string;
}

/**
 * Implements the Shortest Path Faster Algorithm (SPFA) to find arbitrage opportunities.
 * @param graphName The name of the graph in RedisGraph.
 * @param startVertices An array of starting vertex IDs.
 * @param provider An ethers.js provider for interacting with the blockchain.
 */
export async function SPFA(
  graphName: string,
  startVertices: number[],
  provider: ethers.providers.JsonRpcProvider
): Promise<void> {
  // Fetch edges and vertices from the graph database
  //@ts-ignore
  const [edgesResult, verticesResult] = await Promise.all([
    client.query(
      `${graphName}`,
      `MATCH 
                (token0)-[edge]->(token1) 
            RETURN 
                ID(token0), 
                ID(token1), 
                edge.sqrtWeight, 
                ID(edge)
            ORDER BY 
                ID(token0) 
                ASC`
    ),
    client.query(
      `${graphName}`,
      `MATCH 
                (token0) 
            RETURN 
                ID(token0), 
                token0.id`
    ),
  ]).catch(() => {
    throw new Error("eGET_V2/V3 \n SPFA()");
  });

  // Map the query results to Edge and Vertex objects
  const edges: Edge[] = edgesResult[0][1].map((edge: any) => ({
    from: edge[0],
    to: edge[1],
    sqrtWeight: edge[2],
    id: edge[3],
  }));
  const vertices: Vertex[] = verticesResult[1][1].map((vertex: any) => ({
    id: vertex[0],
    tokenId: vertex[1],
  }));

  const dis: bigint[] = Array(vertices.length).fill(0n); // Distance array
  const pre: (number | undefined)[] = Array(vertices.length).fill(undefined); // Predecessor array
  const preInfo: (string | undefined)[] = Array(vertices.length).fill(
    undefined
  ); // Predecessor edge info array

  // Relax edges |V| - 1 times
  for (let j = 1; j < vertices.length - 1; j++) {
    for (let i = 0; i < edges.length; i++) {
      const { from: u, to: v, sqrtWeight, id } = edges[i];
      const weight = BigInt(sqrtWeight);

      if (dis[u] + weight < dis[v]) {
        dis[v] = dis[u] + weight;
        pre[v] = vertices[u].id;
        preInfo[v] = id;
      }
    }
  }

  // Check for negative cycles
  for (let i = 0; i < edges.length; i++) {
    const { from: u, to: v, sqrtWeight } = edges[i];
    const weight = BigInt(sqrtWeight);

    if (dis[u] + weight < dis[v]) {
      await createPath(
        v,
        vertices,
        pre,
        preInfo,
        graphName,
        startVertices,
        provider
      );
    }
  }
}

/**
 * Constructs a path from a given start vertex and checks for arbitrage opportunities.
 * @param startVertex The starting vertex ID.
 * @param vertices Array of vertices.
 * @param pre Predecessor array.
 * @param preInfo Predecessor edge info array.
 * @param graphName The name of the graph in RedisGraph.
 * @param startVertices An array of starting vertex IDs.
 * @param provider An ethers.js provider for interacting with the blockchain.
 */
async function createPath(
  startVertex: number,
  vertices: Vertex[],
  pre: (number | undefined)[],
  preInfo: (string | undefined)[],
  graphName: string,
  startVertices: number[],
  provider: ethers.providers.JsonRpcProvider
): Promise<void> {
  let confirm: number | undefined = startVertex;
  // Traverse predecessors to find a cycle
  for (let i = 0; i < vertices.length; i++) {
    if (confirm === undefined) break;
    confirm = pre[confirm];
  }

  if (confirm === undefined) return;

  const tokenPath: (string | undefined)[] = [];
  const edgePath: (string | undefined)[] = [];

  // Reconstruct the path
  for (let v = confirm; ; v = pre[v] as number) {
    const vertex = vertices.find((vertex) => vertex.id === v);
    if (vertex) tokenPath.push(vertex.tokenId);
    if (confirm === v && tokenPath.length > 1) break;
    edgePath.push(preInfo[v]);
  }

  tokenPath.reverse();

  // Fetch additional edge information for the path
  const additional = await client.query(
    graphName,
    `MATCH 
                (token1)-[before_swap]->(token0)-[after_swap]->(token1) 
            WHERE 
                token0.id = '${tokenPath[0]}' 
            AND 
                ID(token1) 
            IN 
                [${startVertices}] 
            RETURN 
                ID(before_swap),
                ID(after_swap),
                token1.id`
  );

  if (additional[1][0] == null) return;

  edgePath.push(additional[1][0][0]);
  edgePath.unshift(additional[1][0][1]);

  // Fetch detailed edge information
  const res = await client.query(
    graphName,
    `MATCH 
                (token0)-[edge]->(token1) 
            WHERE 
                ID(edge) IN [${edgePath}]
            RETURN 
                edge.amount, 
                edge.reserve0, 
                edge.reserve1, 
                edge.tick, 
                edge.feeTier, 
                edge.zeroForOne, 
                edge.router`
  );

  const edgeInfo: EdgeInfo[] = res[1].map((edge: any) => ({
    amount: edge[0],
    reserve0: edge[1],
    reserve1: edge[2],
    tick: edge[3],
    feeTier: edge[4],
    zeroForOne: edge[5],
    router: edge[6],
  }));

  // Adjust token path if necessary
  if (tokenPath[0] !== additional[1][0][2]) {
    tokenPath.unshift(additional[1][0][2]);
    tokenPath.push(additional[1][0][2]);
  }

  // Check loan possibility and execute if profitable
  checkLoanPossibility(edgeInfo, tokenPath, provider);
}
// const Queue: any[][] = []
// let iter = 0
// Queue.push(...vertices)

// while (Queue.length != 0) {
// const tokenPath: any[] = [] //ścieżka wymiany tokenów
// const feeTierPath: any[] = [] //ścieżka feeTierów
// let u = Queue.shift()

//     for (let i = 0; i < edges.length; i++) { //iteracja po krawędziach odchodzących od wierzchłoka
//         const weight = BigInt(edges[i][2]) //waga krawędzi
//         let v = edges[i][1] //wierzchołek do którego prowadzi krawędź

//         if (u[0] === edges[i][0] && dis[u[0]] + weight < dis[v]) {

//             dis[v] = dis[u[0]] + weight
//             pre[v] = vertices[u[0]]

//             !Queue.some((e) => e[0] == v[0]) && Queue.push(v)

//             //     let cycle = []

//             //     for (let j = pre[v][0];; j = pre[j]) {
//             //         cycle.push(pre[j])
//             //         if (j == pre[v][0] && cycle.length > 1)
//             //             break
//             //     }
//             //     cycle.reverse()
//             //     console.log(cycle)
//             // }
//             // tokenPath.push(u[1]) //token0
//             // feeTierPath.push(
//             //     edgeInfo[j][4] == undefined //feeTier
//             //         ? 0
//             //         : edgeInfo[j][4]
//             // )

//             // earlyTermination(
//             //     [pre, preInfo],
//             //     [tokenPath, feeTierPath],
//             //     swapToken,
//             //     provider,
//             //     maxHops
//             // )
//         }
//     }
//     if (++iter == vertices.length - 1) break
// }
