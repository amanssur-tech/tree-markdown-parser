#!/usr/bin/env node
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTreeBlock } from "../parser/parseTreeBlock.js";
import { renderHTML } from "../renderer/renderHTML.js";
import { renderText } from "../renderer/renderText.js";
import { defaultTreeTheme } from "../renderer/defaultTheme.js";

interface CliOptions {
  input?: string;
  output?: string;
  text: boolean;
  htmlOnly: boolean;
  to?: string;
  pandocArgs: string[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    text: false,
    htmlOnly: false,
    pandocArgs: [],
  };
  const remaining = [...argv];

  while (remaining.length > 0) {
    const arg = remaining.shift();
    if (!arg) {
      continue;
    }
    if (arg === "--") {
      options.pandocArgs.push(...remaining);
      break;
    }
    if (arg === "--text") {
      options.text = true;
      continue;
    }
    if (arg === "--html-only") {
      options.htmlOnly = true;
      continue;
    }
    if (arg === "--to" || arg === "-t") {
      options.to = remaining.shift();
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
    if (arg.startsWith("-")) {
      options.pandocArgs.push(arg);
      const peek = remaining[0];
      if (peek && !peek.startsWith("-")) {
        options.pandocArgs.push(remaining.shift() ?? "");
      }
      continue;
    }
    if (!options.input) {
      options.input = arg;
      continue;
    }
    options.pandocArgs.push(arg);
  }

  return options;
}

function printHelp(): void {
  process.stdout.write(`tmd (tree-markdown-parser)

Usage:
  tmd --input README.md --output README.out.md
  tmd README.md --to html
  tmd README.md --to pdf -o README.pdf
  tmd --text < input.md > output.md

Options:
  -i, --input   Input markdown file (defaults to stdin)
  -o, --output  Output markdown file (defaults to stdout)
  -t, --to      Run Pandoc with the given output format
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
const cssMarker = 'data-tree-markdown="true"';

const pandocCssPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../renderer/tree.css",
);

function shouldInjectCss(markdown: string, options: CliOptions): boolean {
  if (options.text || options.htmlOnly) {
    return false;
  }
  return !markdown.includes(cssMarker);
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

function hasPandocOutputArg(args: string[]): boolean {
  return args.includes("-o") || args.includes("--output");
}

function hasPdfEngineArg(args: string[]): boolean {
  return args.some((arg) => arg.startsWith("--pdf-engine"));
}

function defaultPandocOutput(inputPath: string, format: string): string {
  const parsed = parse(inputPath);
  return join(parsed.dir, `${parsed.name}.${format}`);
}

async function runPandoc(
  inputPath: string,
  outputPath: string | undefined,
  format: string,
  extraArgs: string[],
): Promise<void> {
  const args = [inputPath, "--to", format, "-c", pandocCssPath, ...extraArgs];
  if (format === "pdf" && !hasPdfEngineArg(extraArgs)) {
    args.push("--pdf-engine=wkhtmltopdf");
  }
  if (outputPath && !hasPandocOutputArg(extraArgs)) {
    args.push("-o", outputPath);
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn("pandoc", args, { stdio: "inherit" });
    child.on("error", (err) => {
      if (err && typeof err === "object" && "code" in err) {
        const code = (err as { code?: string }).code;
        if (code === "ENOENT") {
          rejectPromise(
            new Error(
              "Pandoc not found. Install Pandoc to use --to (https://pandoc.org/installing.html).",
            ),
          );
          return;
        }
      }
      rejectPromise(err);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        if (format === "pdf" && !hasPdfEngineArg(extraArgs)) {
          rejectPromise(
            new Error(
              "Pandoc failed. For PDF output, install wkhtmltopdf or pass --pdf-engine to Pandoc (e.g. -- --pdf-engine=weasyprint).",
            ),
          );
          return;
        }
        rejectPromise(
          new Error(
            `Pandoc failed with exit code ${code ?? "unknown"}. Check your Pandoc flags and input.`,
          ),
        );
      }
    });
  });
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.text && options.to) {
    throw new Error("--text cannot be combined with --to");
  }
  const input = options.input
    ? await readFile(options.input, "utf8")
    : await readStdin();
  const isPandocMode = Boolean(options.to);
  const output = replaceTreeBlocks(input, {
    ...options,
    htmlOnly: isPandocMode ? true : options.htmlOnly,
  });

  if (isPandocMode) {
    const format = options.to ?? "html";
    const tempDir = await mkdtemp(join(tmpdir(), "tmd-"));
    const tempPath = join(tempDir, "tmd-preprocessed.md");
    try {
      await writeFile(tempPath, output, "utf8");
      let outputPath = options.output;
      if (!outputPath) {
        if (!options.input) {
          throw new Error("Provide --output when using stdin with --to");
        }
        outputPath = defaultPandocOutput(options.input, format);
      }
      await runPandoc(tempPath, outputPath, format, options.pandocArgs);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  } else if (options.output) {
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
