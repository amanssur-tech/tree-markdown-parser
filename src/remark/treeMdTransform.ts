// Transform plugin for MDAST tools like `remark` that swaps fenced tree blocks with rendered HTML.
import { parseTreeBlock } from "../tree/parseTreeBlock.js";
import { renderHTML } from "../renderer/renderHTML.js";
import type { ParseOptions } from "../tree/types.js";

type MdastNode = {
  type: string;
  lang?: string;
  value?: string;
  children?: MdastNode[];
};

export interface TreeMarkdownOptions {
  parse?: ParseOptions;
  htmlRootClass?: string;
}

export function TreeMarkdown(options?: TreeMarkdownOptions) {
  return (tree: MdastNode) => transformNode(tree, options);
}

export default TreeMarkdown;

function transformNode(
  node: MdastNode,
  options?: TreeMarkdownOptions,
): MdastNode {
  if (
    node.type === "code" &&
    node.lang === "tree" &&
    typeof node.value === "string"
  ) {
    const tree = parseTreeBlock(node.value, options?.parse);
    const html = renderHTML(tree, { rootClass: options?.htmlRootClass });
    return { type: "html", value: html };
  }

  if (node.children && node.children.length > 0) {
    node.children = node.children.map((child) => transformNode(child, options));
  }

  return node;
}
