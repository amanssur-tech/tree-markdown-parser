// Lightweight tree renderer for VS Code Markdown preview.
//
// This file intentionally reimplements tree parsing and HTML rendering logic
// instead of importing from the core package. VS Code preview runs in an
// isolated environment where bundling core runtime dependencies would add
// unnecessary complexity and overhead.
//
// The renderer hooks directly into the Markdown fence rule and only intercepts
// ```tree blocks, delegating all other Markdown rendering to VS Code unchanged.

// Minimal markdown-it–compatible renderer surface used by VS Code.
// We define a narrow interface here to avoid depending on markdown-it types.
export interface TreeRendererInstance {
  renderer: {
    rules: {
      fence?: (
        tokens: Array<{ info?: string; content?: string }>,
        idx: number,
        options: unknown,
        env: unknown,
        self: { renderToken: (t: unknown, i: number, o: unknown) => string },
      ) => string;
    };
  };
  use: (plugin: TreeRendererPlugin) => TreeRendererInstance;
}

// Plugin signature matching markdown-it's `.use()` convention,
// kept local to avoid importing markdown-it at runtime.
export type TreeRendererPlugin = (
  md: TreeRendererInstance,
  options?: unknown,
) => void;

interface TreeNode {
  name: string;
  type: "file" | "folder";
  children: TreeNode[];
}

interface LineToken {
  name: string;
  level: number;
  explicitFolder: boolean;
}

// Register a custom fence rule that renders fenced ```tree blocks as HTML trees.
// Non-tree fences are passed through to the original renderer untouched.
export default function treeRenderer(md: TreeRendererInstance): void {
  const fallbackFence = md.renderer.rules.fence;

  const fenceRule = (
    tokens: Array<{ info?: string; content?: string }>,
    idx: number,
    fenceOptions: unknown,
    env: unknown,
    self: { renderToken: (t: unknown, i: number, o: unknown) => string },
  ): string => {
    const token = tokens[idx];
    const lang = token?.info?.trim().split(/\s+/)[0] ?? "";
    if (lang === "tree") {
      const tree = parseTreeBlock(token.content ?? "");
      return renderHTML(tree);
    }

    if (fallbackFence) {
      // Preserve upstream fence rendering for non-tree blocks.
      return fallbackFence(tokens, idx, fenceOptions, env, self);
    }
    return self.renderToken(tokens, idx, fenceOptions);
  };
  md.renderer.rules.fence = fenceRule;
}

// Parse a raw tree block into a structured tree representation.
// This mirrors the core parser logic but is duplicated here for isolation.
function parseTreeBlock(input: string): TreeNode[] {
  const tokens = tokenizeLines(input);
  return buildTree(tokens);
}

// Convert raw tree lines into indentation-aware tokens.
// Empty lines and whitespace-only lines are ignored.
function tokenizeLines(input: string): LineToken[] {
  const lines = input.split(/\r?\n/);
  const tokens: LineToken[] = [];

  for (const rawLine of lines) {
    if (!rawLine.trim()) {
      continue;
    }

    const { level, content } = parseIndentation(rawLine);
    const explicitFolder = content.endsWith("/");
    const name = explicitFolder ? content.slice(0, -1).trim() : content.trim();

    if (!name) {
      continue;
    }

    tokens.push({ name, level, explicitFolder });
  }

  return tokens;
}

// Normalize mixed tab/space indentation to a consistent space-based format.
// This improves robustness for copy-pasted ASCII trees.
function normalizeIndentation(rawLine: string): string {
  let idx = 0;
  while (
    idx < rawLine.length &&
    (rawLine[idx] === " " || rawLine[idx] === "\t")
  ) {
    idx += 1;
  }
  if (!rawLine.slice(0, idx).includes("\t")) {
    return rawLine;
  }
  const leading = rawLine.slice(0, idx).replaceAll("\t", "  ");
  return leading + rawLine.slice(idx);
}

// Read indentation guides (│ and spaces) to determine nesting depth.
// Supports both guide-based and space-based tree layouts.
function readIndentUnits(line: string): { level: number; cursor: number } {
  let level = 0;
  let cursor = 0;

  const readSpaces = (): number => {
    let count = 0;
    while (cursor < line.length && line[cursor] === " ") {
      count += 1;
      cursor += 1;
    }
    return count;
  };

  while (cursor < line.length) {
    if (line[cursor] === "│") {
      cursor += 1;
      const spaceCount = readSpaces();
      if (spaceCount > 0) {
        level += 1;
        continue;
      }
      break;
    }

    if (line[cursor] === " ") {
      const spaceCount = readSpaces();
      level += Math.floor(spaceCount / 2);
      continue;
    }

    break;
  }

  return { level, cursor };
}

// Consume branch markers (├─ / └─) and advance the cursor past them.
// A branch prefix contributes an additional nesting level.
function readBranchPrefix(
  line: string,
  cursor: number,
): { levelBoost: number; cursor: number } {
  if (line[cursor] !== "├" && line[cursor] !== "└") {
    return { levelBoost: 0, cursor };
  }

  let next = cursor + 1;
  while (line[next] === "─" || line[next] === "-") {
    next += 1;
  }
  if (line[next] === " ") {
    next += 1;
  }
  return { levelBoost: 1, cursor: next };
}

// Parse a single line into its nesting level and content payload.
// Combines indentation guides, branch prefixes, and trimming logic.
function parseIndentation(rawLine: string): { level: number; content: string } {
  const line = normalizeIndentation(rawLine);
  const indent = readIndentUnits(line);
  const branch = readBranchPrefix(line, indent.cursor);
  const level = indent.level + branch.levelBoost;
  const content = line.slice(branch.cursor).trim();
  return { level, content };
}

// Heuristic to detect names that are likely folders even without a dot.
// Used to improve folder/file guessing for copy-pasted trees.
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

// Build a hierarchical tree from flat indentation tokens.
// Folder/file classification is finalized after structure is known.
function buildTree(tokens: LineToken[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: TreeNode[] = [];
  const explicitFolders = new Set<string>();

  for (const token of tokens) {
    let level = token.level;
    if (level > stack.length) {
      level = stack.length;
    }

    while (stack.length > level) {
      stack.pop();
    }

    if (token.explicitFolder) {
      explicitFolders.add(token.name);
    }

    const node: TreeNode = {
      name: token.name,
      type: "file",
      children: [],
    };

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack.at(-1)?.children.push(node);
    }

    stack.push(node);
  }

  const finalize = (node: TreeNode): TreeNode => {
    const children = node.children.map(finalize);
    if (children.length > 0 || explicitFolders.has(node.name)) {
      return { ...node, type: "folder", children };
    }
    const hasDot = node.name.includes(".");
    return {
      ...node,
      type: hasDot || isAllCaps(node.name) ? "file" : "folder",
      children,
    };
  };

  return roots.map(finalize);
}

// Escape HTML-sensitive characters to prevent markup injection
// in rendered tree labels.
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Render the tree structure to semantic HTML using <ul>, <li>, and <details>.
// The output is styled externally via CSS injected by the extension.
function renderHTML(nodes: TreeNode[]): string {
  const renderNode = (node: TreeNode): string => {
    const classes = `tree-node ${node.type}`;
    const label = escapeHtml(node.name);
    const children = node.children.length
      ? `<ul>${node.children.map(renderNode).join("")}</ul>`
      : "";

    if (node.type === "folder") {
      return `<li class="${classes}" data-type="${node.type}"><details open><summary><span class="tree-label">${label}</span></summary>${children}</details></li>`;
    }

    return `<li class="${classes}" data-type="${node.type}"><span class="tree-label">${label}</span>${children}</li>`;
  };

  return `<ul class="tree">${nodes.map(renderNode).join("")}</ul>`;
}
