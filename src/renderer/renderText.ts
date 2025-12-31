import { TreeNode } from "../types/tree.js";

export function renderText(nodes: TreeNode[]): string {
  const lines: string[] = [];

  const walk = (node: TreeNode, depth: number): void => {
    const indent = "  ".repeat(depth);
    const label = node.type === "folder" ? `${node.name}/` : node.name;
    lines.push(`${indent}- ${label}`);
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  };

  for (const node of nodes) {
    walk(node, 0);
  }

  return lines.join("\n");
}
