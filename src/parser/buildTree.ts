import {
  LineToken,
  ParseOptions,
  TreeNode,
  TreeNodeType,
} from "../types/tree.js";
import { resolveOptions } from "../utils/indentation.js";
import { TreeParseError } from "../types/errors.js";

interface WorkingNode {
  name: string;
  explicitFolder: boolean;
  children: WorkingNode[];
}

function hasFileExtension(name: string): boolean {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 && dotIndex < name.length - 1;
}

function finalizeNode(node: WorkingNode): TreeNode {
  const children = node.children.map(finalizeNode);
  let type: TreeNodeType;

  if (children.length > 0 || node.explicitFolder) {
    type = "folder";
  } else if (hasFileExtension(node.name)) {
    type = "file";
  } else {
    type = "folder";
  }

  return {
    name: node.name,
    type,
    children,
  };
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
