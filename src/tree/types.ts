// Shared tree AST types used across parsing and rendering.
export type TreeNodeType = "file" | "folder";

export interface TreeNode {
  name: string;
  type: TreeNodeType;
  children: TreeNode[];
}

export type ParseMode = "strict" | "tolerant";

export interface ParseOptions {
  mode?: ParseMode;
  tabWidth?: number;
  indentWidth?: number;
}

export interface LineToken {
  name: string;
  level: number;
  explicitFolder: boolean;
  line: number;
}
