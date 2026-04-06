import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";

const colors = {
  none: "#7f8ea3",
  low: "#61d7b5",
  medium: "#f5c66a",
  high: "#ff7d7d"
};

function buildVisibleTree(node, collapsedIds) {
  if (!node) {
    return null;
  }
  return {
    ...node,
    children: collapsedIds.has(node.id)
      ? []
      : (node.children || []).map((child) => buildVisibleTree(child, collapsedIds))
  };
}

export default function AstTree({
  tree,
  selectedNodeId,
  collapsedIds,
  onSelectNode,
  onToggleNode
}) {
  const svgRef = useRef(null);
  const visibleTree = useMemo(() => buildVisibleTree(tree, collapsedIds), [tree, collapsedIds]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (!visibleTree) {
      return;
    }

    const root = d3.hierarchy(visibleTree);
    const layout = d3.tree().nodeSize([44, 190]);
    layout(root);

    const nodes = root.descendants();
    const links = root.links();
    const minX = d3.min(nodes, (node) => node.x) ?? 0;
    const maxX = d3.max(nodes, (node) => node.x) ?? 0;
    const maxY = d3.max(nodes, (node) => node.y) ?? 0;
    const width = maxY + 280;
    const height = maxX - minX + 120;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const canvas = svg.append("g").attr("transform", `translate(72, ${60 - minX})`);

    canvas
      .append("g")
      .attr("class", "ast-links")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr(
        "d",
        d3
          .linkHorizontal()
          .x((node) => node.y)
          .y((node) => node.x)
      )
      .attr("fill", "none")
      .attr("stroke", "#253043")
      .attr("stroke-width", 1.5);

    const nodeLayer = canvas
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", (node) => `translate(${node.y}, ${node.x})`);

    nodeLayer
      .append("circle")
      .attr("r", 10)
      .attr("fill", (node) => colors[node.data.risk] || colors.none)
      .attr("stroke", (node) => (node.data.id === selectedNodeId ? "#f6f7fb" : "#0e1624"))
      .attr("stroke-width", (node) => (node.data.id === selectedNodeId ? 3 : 1.5))
      .style("cursor", "pointer")
      .on("click", (_, node) => onSelectNode(node.data.id));

    nodeLayer
      .filter((node) => (node.data.children || []).length > 0)
      .append("circle")
      .attr("cx", -18)
      .attr("r", 7)
      .attr("fill", "#162133")
      .attr("stroke", "#2a3b52")
      .style("cursor", "pointer")
      .on("click", (event, node) => {
        event.stopPropagation();
        onToggleNode(node.data.id);
      });

    nodeLayer
      .filter((node) => (node.data.children || []).length > 0)
      .append("text")
      .attr("x", -18)
      .attr("y", 4)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#cfd8e7")
      .style("pointer-events", "none")
      .text((node) => (collapsedIds.has(node.data.id) ? "+" : "-"));

    nodeLayer
      .append("text")
      .attr("x", 18)
      .attr("y", -3)
      .attr("fill", "#f3f7ff")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .text((node) => truncate(node.data.label, 34));

    nodeLayer
      .append("text")
      .attr("x", 18)
      .attr("y", 14)
      .attr("fill", "#8da0bc")
      .attr("font-size", 11)
      .text((node) => `${node.data.type} · L${node.data.lineno}`);
  }, [collapsedIds, onSelectNode, onToggleNode, selectedNodeId, visibleTree]);

  if (!tree) {
    return <div className="empty-card">AST tree will appear after a scan.</div>;
  }

  return (
    <div className="ast-tree-shell">
      <svg ref={svgRef} className="ast-tree-svg" role="img" aria-label="AST visualization" />
    </div>
  );
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}...`;
}
