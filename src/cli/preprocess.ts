#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { parseTreeBlock } from "../parser/parseTreeBlock.js";
import { renderHTML } from "../renderer/renderHTML.js";
import { renderText } from "../renderer/renderText.js";
import { defaultTreeTheme } from "../renderer/defaultTheme.js";

interface CliOptions {
  input?: string;
  output?: string;
  text: boolean;
  htmlOnly: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { text: false, htmlOnly: false };
  const remaining = [...argv];

  while (remaining.length > 0) {
    const arg = remaining.shift();
    if (!arg) {
      continue;
    }
    if (arg === "--text") {
      options.text = true;
      continue;
    }
    if (arg === "--html-only") {
      options.htmlOnly = true;
      continue;
    }
    if (arg === "--input" || arg === "-i") {
      options.input = remaining.shift();
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      options.output = remaining.shift();
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  process.stdout.write(`tmd (tree-markdown-parser)

Usage:
  tmd --input README.md --output README.out.md
  tmd --text < input.md > output.md

Options:
  -i, --input   Input markdown file (defaults to stdin)
  -o, --output  Output markdown file (defaults to stdout)
  --text        Render tree blocks as plain text fenced blocks
  --html-only   Render HTML without injecting CSS (useful for GitHub)
  -h, --help    Show this help message
`);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", (err) => reject(err));
  });
}

const fencePattern = /^(`{3,})\s*tree\b.*$/;
const closingPattern = /^(`{3,})\s*$/;

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

function renderReplacement(rawTree: string, options: CliOptions): string[] {
  const tree = parseTreeBlock(rawTree);
  if (options.text) {
    return ["```text", renderText(tree), "```"];
  }
  return [renderHTML(tree)];
}

const cssStyleTag = `<style data-tree-markdown="true">\n${defaultTreeTheme}\n</style>`;
const cssLinkTag =
  '<link rel="stylesheet" href="tree.css" data-tree-markdown="true" />';

function shouldInjectCss(markdown: string, options: CliOptions): boolean {
  if (options.text || options.htmlOnly) {
    return false;
  }
  return !markdown.includes('data-tree-markdown="true"');
}

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

function replaceTreeBlocks(markdown: string, options: CliOptions): string {
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

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const input = options.input
    ? await readFile(options.input, "utf8")
    : await readStdin();
  const output = replaceTreeBlocks(input, options);

  if (options.output) {
    await writeFile(options.output, output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

try {
  await run();
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
