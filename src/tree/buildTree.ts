// Assemble a hierarchical tree from flat line tokens, honoring strictness rules.
import { resolveOptions } from "./indentation.js";
import { TreeParseError } from "./errors.js";
import { LineToken, ParseOptions, TreeNode, TreeNodeType } from "./types.js";

interface WorkingNode {
  name: string;
  explicitFolder: boolean;
  children: WorkingNode[];
}

export function buildTree(
  tokens: LineToken[],
  options?: ParseOptions,
): TreeNode[] {
  const resolved = resolveOptions(options);
  const roots: WorkingNode[] = [];
  const stack: WorkingNode[] = [];

  for (const token of tokens) {
    let level = token.level;

    if (level > stack.length) {
      // In strict mode, gaps usually mean the tree copy lost indentation.
      if (resolved.mode === "strict") {
        throw new TreeParseError("Non-monotonic indentation", token.line);
      }
      level = stack.length;
    }

    while (stack.length > level) {
      stack.pop();
    }

    const node: WorkingNode = {
      name: token.name,
      explicitFolder: token.explicitFolder,
      children: [],
    };

    if (stack.length === 0) {
      roots.push(node);
    } else {
      const parent = stack.at(-1);
      if (!parent) {
        throw new TreeParseError("Invalid tree structure", token.line);
      }
      parent.children.push(node);
    }

    stack.push(node);
  }

  return roots.map(finalizeNode);
}

function finalizeNode(node: WorkingNode): TreeNode {
  const children = node.children.map(finalizeNode);
  let type: TreeNodeType;

  if (children.length > 0 || node.explicitFolder) {
    type = "folder";
  } else {
    // Prefer readable heuristics for leaf nodes; exactness is less valuable here.
    const hasDot = node.name.includes(".");
    if (hasDot || isAllCaps(node.name)) {
      type = "file";
    } else {
      type = "folder";
    }
  }

  return {
    name: node.name,
    type,
    children,
  };
}

function isAllCaps(name: string): boolean {
  const trimmed = name.trim();
  const spaceIndex = trimmed.indexOf(" ");
  const parenIndex = trimmed.indexOf("(");
  const splitIndexCandidates = [spaceIndex, parenIndex].filter(
    (index) => index >= 0,
  );
  const splitIndex =
    splitIndexCandidates.length > 0 ? Math.min(...splitIndexCandidates) : -1;
  const prefix = splitIndex >= 0 ? trimmed.slice(0, splitIndex) : trimmed;
  const letters = prefix.replaceAll(/[^A-Za-z]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}
