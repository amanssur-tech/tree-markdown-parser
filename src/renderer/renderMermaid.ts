// Let Mermaid output keep a stable node id list for easier diffing in docs.
import { TreeNode } from "../tree/types.js";

export function renderMermaid(nodes: TreeNode[]): string {
  const lines: string[] = ["graph TD"];
  let counter = 0;

  const walk = (node: TreeNode, parentId?: string): void => {
    counter += 1;
    const id = `n${counter}`;
    const label = node.type === "folder" ? `${node.name}/` : node.name;
    lines.push(`${id}["${escapeLabel(label)}"]`);
    if (parentId) {
      lines.push(`${parentId} --> ${id}`);
    }
    for (const child of node.children) {
      walk(child, id);
    }
  };

  for (const node of nodes) {
    walk(node);
  }

  return lines.join("\n");
}

function escapeLabel(value: string): string {
  return value.replaceAll('"', String.raw`\"`);
}
