import { useMemo } from "react";

export default function useGraphPhysics(nodeCount) {
  return useMemo(() => {
    const isSmall = nodeCount < 20;
    return {
      d3AlphaDecay: 0.02,
      d3VelocityDecay: 0.3,
      d3Alpha: 1.0,
      d3AlphaMin: 0.001,
      d3ReheatSimulation: false,
      warmupTicks: isSmall ? 100 : 200,
      cooldownTicks: isSmall ? 50 : 100,
      cooldownTime: 15000,
      nodeRelSize: 4,
      numDimensions: 3,
      linkDistance: isSmall ? 80 : 120,
      linkStrength: isSmall ? 0.8 : 0.4,
      collisionDistance: isSmall ? 15 : 25,
    };
  }, [nodeCount]);
}
