import { TreeNode } from "../types/tree.js";

export interface RenderHTMLOptions {
  rootClass?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderNode(node: TreeNode): string {
  const classes = `tree-node ${node.type}`;
  const label = escapeHtml(node.name);
  const children = node.children.length
    ? `<ul>${node.children.map(renderNode).join("")}</ul>`
    : "";

  return `<li class="${classes}" data-type="${node.type}"><span class="tree-label">${label}</span>${children}</li>`;
}

export function renderHTML(
  nodes: TreeNode[],
  options?: RenderHTMLOptions,
): string {
  const rootClass = options?.rootClass ?? "tree";
  return `<ul class="${rootClass}">${nodes.map(renderNode).join("")}</ul>`;
}
