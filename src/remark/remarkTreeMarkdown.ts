import { parseTreeBlock } from "../parser/parseTreeBlock.js";
import { renderHTML } from "../renderer/renderHTML.js";
import type { ParseOptions } from "../types/tree.js";

type MdastNode = {
  type: string;
  lang?: string;
  value?: string;
  children?: MdastNode[];
};

export interface RemarkTreeMarkdownOptions {
  parse?: ParseOptions;
  htmlRootClass?: string;
}

function transformNode(
  node: MdastNode,
  options?: RemarkTreeMarkdownOptions,
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

export function remarkTreeMarkdown(options?: RemarkTreeMarkdownOptions) {
  return (tree: MdastNode) => transformNode(tree, options);
}

export default remarkTreeMarkdown;
