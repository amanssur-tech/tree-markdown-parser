import { ParseOptions, TreeNode } from "../types/tree.js";
import { tokenizeLines } from "./tokenizeLines.js";
import { buildTree } from "./buildTree.js";

export function parseTreeBlock(
  input: string,
  options?: ParseOptions,
): TreeNode[] {
  const tokens = tokenizeLines(input, options);
  return buildTree(tokens, options);
}
