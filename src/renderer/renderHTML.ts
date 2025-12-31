import { TreeNode } from "../types/tree.js";

export interface RenderHTMLOptions {
  rootClass?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderNode(node: TreeNode): string {
  const classes = `tree-node ${node.type}`;
  const label = escapeHtml(node.name);
  const hasChildren = node.children.length > 0;
  const children = hasChildren
    ? `<ul>${node.children.map(renderNode).join("")}</ul>`
    : "";

  if (node.type === "folder") {
    return `<li class="${classes}" data-type="${node.type}"><details open><summary><span class="tree-label">${label}</span></summary>${children}</details></li>`;
  }

  return `<li class="${classes}" data-type="${node.type}"><span class="tree-label">${label}</span>${children}</li>`;
}

export function renderHTML(
  nodes: TreeNode[],
  options?: RenderHTMLOptions,
): string {
  const rootClass = options?.rootClass ?? "tree";
  return `<ul class="${rootClass}">${nodes.map(renderNode).join("")}</ul>`;
}
