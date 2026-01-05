// Central entrypoint for turning a tree code block into a structured AST.
// Kept small so callers can reason about the full parse pipeline quickly.
import { buildTree } from "./buildTree.js";
import { tokenizeLines } from "./tokenizeLines.js";
import { ParseOptions, TreeNode } from "./types.js";

export function parseTreeBlock(
  input: string,
  options?: ParseOptions,
): TreeNode[] {
  const tokens = tokenizeLines(input, options);
  return buildTree(tokens, options);
}
