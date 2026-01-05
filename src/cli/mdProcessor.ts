// Markdown-only transformation for fenced tree blocks (no IO, no Pandoc).
// Used by the CLI preprocessor for Markdown outputs.

import { defaultTreeTheme } from "../renderer/defaultTheme.js";
import { renderHTML } from "../renderer/renderHTML.js";
import { renderText } from "../renderer/renderText.js";
import { parseTreeBlock } from "../tree/parseTreeBlock.js";

// Controls how fenced tree blocks are rewritten.
// This processor never writes files or shells out; it only transforms Markdown text.
export interface MdProcessorOptions {
  text: boolean;
  htmlOnly: boolean;
}

// Match only explicit ```tree fences.
// Auto-detection is intentionally avoided to prevent false positives.
const fencePattern = /^(`{3,})\s*tree\b.*$/;
const closingPattern = /^(`{3,})\s*$/;

const cssStyleTag = `<style data-tree-markdown="true">\n${defaultTreeTheme}\n</style>`;
const cssLinkTag =
  '<link rel="stylesheet" href="tree.css" data-tree-markdown="true" />';
const cssMarker = 'data-tree-markdown="true"';

export function replaceTreeBlocks(
  markdown: string,
  options: MdProcessorOptions,
): string {
  const output: string[] = [];
  const remaining = markdown.split(/\r?\n/);

  while (remaining.length > 0) {
    const line = remaining.shift();
    if (line === undefined) {
      continue;
    }
    const fence = matchFence(line);
    if (!fence) {
      output.push(line);
      continue;
    }

    const content = readFenceContent(remaining, fence);
    if (!content.closed) {
      throw new Error("Unclosed ```tree block");
    }

    output.push(...renderReplacement(content.content, options));
  }

  const replaced = output.join("\n");
  return shouldInjectCss(markdown, options) ? injectCss(replaced) : replaced;
}

function matchFence(line: string): string | null {
  const match = fencePattern.exec(line);
  return match?.[1] ?? null;
}

function readFenceContent(
  remaining: string[],
  fence: string,
): { content: string; closed: boolean } {
  const contentLines: string[] = [];

  while (remaining.length > 0) {
    const candidate = remaining.shift();
    if (candidate === undefined) {
      continue;
    }
    const closingMatch = closingPattern.exec(candidate);
    const closingFence = closingMatch?.[1];
    if (closingFence && closingFence.length === fence.length) {
      return { content: contentLines.join("\n"), closed: true };
    }
    contentLines.push(candidate);
  }

  return { content: contentLines.join("\n"), closed: false };
}

function renderReplacement(
  rawTree: string,
  options: MdProcessorOptions,
): string[] {
  const tree = parseTreeBlock(rawTree);
  if (options.text) {
    return ["```text", renderText(tree), "```"];
  }
  return [renderHTML(tree)];
}

// Decide whether tree CSS should be injected.
// CSS is injected only once and only for Markdown preview outputs.
// GitHub strips <link> tags and renders <style> blocks as raw text,
// so injection is skipped for text and HTML-only modes.
function shouldInjectCss(
  markdown: string,
  options: MdProcessorOptions,
): boolean {
  if (options.text || options.htmlOnly) {
    return false;
  }
  return !markdown.includes(cssMarker);
}

// Inject CSS after YAML frontmatter if present, otherwise at the top of the document.
// This preserves frontmatter semantics for Markdown renderers.
function injectCss(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  if (lines[0] === "---") {
    const closingIndex = lines.findIndex(
      (line, index) => index > 0 && line === "---",
    );
    if (closingIndex !== -1) {
      lines.splice(closingIndex + 1, 0, cssStyleTag, cssLinkTag, "");
      return lines.join("\n");
    }
  }
  lines.unshift(cssStyleTag, cssLinkTag, "");
  return lines.join("\n");
}
