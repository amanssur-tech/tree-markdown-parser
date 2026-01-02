import { parseTreeBlock } from "../parser/parseTreeBlock.js";
import { renderHTML } from "../renderer/renderHTML.js";
import type { ParseOptions } from "../types/tree.js";

interface MarkdownItInstance {
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
}

export interface MarkdownItTreeOptions {
  parse?: ParseOptions;
  htmlRootClass?: string;
}

function getFenceLang(info?: string): string {
  if (!info) {
    return "";
  }
  return info.trim().split(/\s+/)[0] ?? "";
}

export function markdownItTree(
  md: MarkdownItInstance,
  options?: MarkdownItTreeOptions,
): void {
  const fallbackFence = md.renderer.rules.fence;

  const fenceRule = (
    tokens: Array<{ info?: string; content?: string }>,
    idx: number,
    fenceOptions: unknown,
    env: unknown,
    self: { renderToken: (t: unknown, i: number, o: unknown) => string },
  ): string => {
    const token = tokens[idx];
    if (!token) {
      if (fallbackFence) {
        return fallbackFence(tokens, idx, fenceOptions, env, self);
      }
      return "";
    }
    const lang = getFenceLang(token.info);
    if (lang === "tree") {
      const tree = parseTreeBlock(token.content ?? "", options?.parse);
      return renderHTML(tree, { rootClass: options?.htmlRootClass });
    }

    if (fallbackFence) {
      return fallbackFence(tokens, idx, fenceOptions, env, self);
    }
    return self.renderToken(tokens, idx, fenceOptions);
  };
  md.renderer.rules.fence = fenceRule;
}

export default markdownItTree;
