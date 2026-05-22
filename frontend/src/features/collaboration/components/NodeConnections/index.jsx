import { memo } from "react";

function getNodeCenter(node) {
  return {
    x: node.position.x + node.size.width / 2,
    y: node.position.y + node.size.height / 2,
  };
}

export const NodeConnections = memo(function NodeConnections({ nodes, edges, selectedNodes }) {
  const nodeMap = {};
  nodes.forEach((n) => { nodeMap[n.nodeId] = n; });

  return (
    <g>
      {edges.map((edge) => {
        const sourceNode = nodeMap[edge.source];
        const targetNode = nodeMap[edge.target];
        if (!sourceNode || !targetNode) return null;

        const source = getNodeCenter(sourceNode);
        const target = getNodeCenter(targetNode);
        const isSelected =
          selectedNodes.has(edge.source) || selectedNodes.has(edge.target);

        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;

        let pathData;
        if (edge.type === "curved") {
          const dx = target.x - source.x;
          const cpOffset = Math.min(Math.abs(dx) * 0.4, 80);
          pathData = `M ${source.x} ${source.y} Q ${source.x + dx / 2} ${source.y - cpOffset} ${target.x} ${target.y}`;
        } else if (edge.type === "dashed") {
          pathData = `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
        } else {
          pathData = `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
        }

        return (
          <g key={edge.edgeId}>
            <path
              d={pathData}
              fill="none"
              stroke={isSelected ? "rgba(34, 211, 238, 0.6)" : "rgba(148, 163, 184, 0.25)"}
              strokeWidth={isSelected ? 2.5 : 1.5}
              strokeDasharray={edge.type === "dashed" ? "6,4" : "none"}
              className="transition-colors duration-200"
            />
            {edge.label && (
              <text
                x={midX}
                y={midY - 8}
                textAnchor="middle"
                fill="rgba(148,163,184,0.6)"
                fontSize="10"
                fontFamily="system-ui"
              >
                {edge.label}
              </text>
            )}
            {edge.type === "curved" && (
              <path
                d={pathData}
                fill="none"
                stroke="rgba(34, 211, 238, 0.08)"
                strokeWidth={8}
                className="pointer-events-auto cursor-pointer hover:stroke-cyan-400/20 transition-colors"
              />
            )}
          </g>
        );
      })}
    </g>
  );
});
