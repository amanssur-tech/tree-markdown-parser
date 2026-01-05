#!/usr/bin/env node
// CLI entrypoint.
// Responsible for argument parsing, command routing, and delegating work
// to either the Markdown-only processor or the Pandoc-based export pipeline.
//
// This file intentionally contains no tree parsing or rendering logic itself;
// it only orchestrates how input flows through the system.
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, parse } from "node:path";
import { replaceTreeBlocks } from "./mdProcessor.js";
import { hasPandocCssArg, runPandocExport, runPreview } from "./pandoc.js";

// Normalized representation of all CLI flags and positional arguments.
// Parsing is split into token handling and positional application to keep
// validation and routing logic predictable.
interface CliOptions {
  command: "preprocess" | "preview";
  input?: string;
  output?: string;
  text: boolean;
  htmlOnly: boolean;
  to?: string;
  pandocArgs: string[];
  styles: string[];
  noStyle: boolean;
  verbose: boolean;
}

// Main execution flow:
// 1. Parse CLI arguments
// 2. Validate flag combinations
// 3. Read input (file or stdin)
// 4. Replace fenced tree blocks
// 5. Route output to preview, Pandoc export, file, or stdout
async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const isPandocMode = Boolean(options.to);
  const isPreviewMode = options.command === "preview";
  validateOptions(options, isPandocMode, isPreviewMode);

  const input = await readInput(options);
  const output = replaceTreeBlocks(input, {
    text: options.text,
    htmlOnly: isPandocMode || isPreviewMode ? true : options.htmlOnly,
  });

  if (isPreviewMode) {
    await runPreview(
      {
        pandocArgs: options.pandocArgs,
        styles: options.styles,
        noStyle: options.noStyle,
        verbose: options.verbose,
      },
      output,
    );
    return;
  }
  if (isPandocMode) {
    await runPandocExport(
      {
        inputPath: options.input,
        outputPath: options.output,
        format: options.to ?? "html",
        pandocArgs: options.pandocArgs,
        styles: options.styles,
        noStyle: options.noStyle,
        verbose: options.verbose,
      },
      output,
    );
    return;
  }

  let outputPath = options.output;
  if (!outputPath && options.input) {
    const parsed = parse(options.input);
    outputPath = join(
      parsed.dir || process.cwd(),
      `${parsed.name}_rendered${parsed.ext || ".md"}`,
    );
  }
  if (outputPath) {
    await writeFile(outputPath, output, "utf8");
    return;
  }
  process.stdout.write(output);
}

try {
  await run();
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

// Parse raw argv tokens into a structured CliOptions object.
// This function does not perform validation; it only interprets intent.
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: "preprocess",
    text: false,
    htmlOnly: false,
    pandocArgs: [],
    styles: [],
    noStyle: false,
    verbose: false,
  };
  const remaining = [...argv];
  if (remaining[0] === "preview") {
    options.command = "preview";
    remaining.shift();
  }
  const positional: string[] = [];
  parseArgsTokens(options, remaining, positional);
  applyPositionalArgs(options, positional);
  return options;
}

// Consume flag tokens and populate CliOptions.
// Unknown flags are forwarded to Pandoc to avoid blocking advanced use cases.
function parseArgsTokens(
  options: CliOptions,
  remaining: string[],
  positional: string[],
): void {
  const takeValue = (flag: string): string => {
    const value = remaining.shift();
    if (!value) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  };

  const handleMetaFlag = (arg: string): boolean => {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--version" || arg === "-v") {
      printVersion();
      process.exit(0);
    }
    return false;
  };

  const handleKnownFlag = (arg: string): boolean => {
    if (arg === "--") {
      options.pandocArgs.push(...remaining);
      remaining.length = 0;
      return true;
    }
    if (arg === "--text") {
      options.text = true;
      return true;
    }
    if (arg === "--html-only") {
      options.htmlOnly = true;
      return true;
    }
    if (arg === "--style") {
      options.styles.push(takeValue("--style"));
      return true;
    }
    if (arg === "--no-style") {
      options.noStyle = true;
      return true;
    }
    if (arg === "--verbose") {
      options.verbose = true;
      return true;
    }
    if (arg === "--to" || arg === "-t") {
      options.to = takeValue(arg);
      return true;
    }
    if (arg === "--input" || arg === "-i") {
      options.input = takeValue(arg);
      return true;
    }
    if (arg === "--output" || arg === "-o") {
      options.output = takeValue(arg);
      return true;
    }
    return false;
  };

  const pushPandocArg = (arg: string): void => {
    options.pandocArgs.push(arg);
    const peek = remaining[0];
    if (peek && !peek.startsWith("-")) {
      options.pandocArgs.push(remaining.shift() ?? "");
    }
  };

  while (remaining.length > 0) {
    const arg = remaining.shift();
    if (!arg) {
      continue;
    }
    if (handleMetaFlag(arg) || handleKnownFlag(arg)) {
      continue;
    }
    if (arg.startsWith("-")) {
      pushPandocArg(arg);
      continue;
    }
    positional.push(arg);
  }
}

// Apply positional arguments (input/output) after flags are processed.
// This mirrors common CLI conventions and avoids order sensitivity.
function applyPositionalArgs(options: CliOptions, positional: string[]): void {
  if (positional.length > 0 && !options.input) {
    options.input = positional[0];
  }
  if (
    positional.length > 1 &&
    !options.output &&
    options.command !== "preview"
  ) {
    options.output = positional[1];
  }
  if (positional.length > 1 && options.command === "preview") {
    options.pandocArgs.push(...positional.slice(1));
  }
}

function printHelp(): void {
  process.stdout.write(`tmd (tree-markdown-parser)

Usage:
  tmd README.md output.md
  tmd --input README.md --output README.out.md
  tmd preview README.md
  tmd README.md --to html
  tmd README.md --to pdf -o README.pdf
  tmd --text < input.md > output.md

Options:
  -i, --input   Input markdown file (defaults to stdin)
  -o, --output  Output markdown file (defaults to stdout)
  -t, --to      Run Pandoc with the given output format
  --text        Render tree blocks as plain text fenced blocks
  --html-only   Render HTML without injecting CSS (useful for GitHub)
  --style       Append a custom CSS file after defaults in Pandoc mode
  --no-style    Disable all CSS in Pandoc mode
  --verbose     Show all Pandoc/WeasyPrint warnings
  -v, --version Show the current version
  -h, --help    Show this help message
`);
}

function printVersion(): void {
  const packageUrl = new URL("../../package.json", import.meta.url);
  const packageJson = readFileSync(packageUrl, "utf8");
  const parsed = JSON.parse(packageJson) as { version?: string };
  process.stdout.write(`${parsed.version ?? "unknown"}\n`);
}

// Enforce valid flag combinations and fail fast on ambiguous or unsafe usage.
// Validation is centralized here to keep the execution path simple.
function validateOptions(
  options: CliOptions,
  isPandocMode: boolean,
  isPreviewMode: boolean,
): void {
  if (options.text && options.to) {
    throw new Error("--text cannot be combined with --to");
  }
  if (options.text && isPreviewMode) {
    throw new Error("--text cannot be combined with preview");
  }
  if (
    (options.styles.length > 0 || options.noStyle) &&
    !isPandocMode &&
    !isPreviewMode
  ) {
    throw new Error("--style/--no-style require --to or preview");
  }
  if (options.noStyle && options.styles.length > 0) {
    throw new Error("--no-style cannot be combined with --style");
  }
  if (options.noStyle && hasPandocCssArg(options.pandocArgs)) {
    throw new Error("--no-style cannot be combined with Pandoc --css/-c");
  }
  if (isPreviewMode && !options.input) {
    throw new Error("preview requires an input file path");
  }
}

// Read input from a file if provided, otherwise fall back to stdin.
// This allows tmd to be used both as a file tool and in Unix pipelines.
async function readInput(options: CliOptions): Promise<string> {
  if (options.input) {
    return readFile(options.input, "utf8");
  }
  return readStdin();
}

// Collect all stdin data into a single string before processing.
// Streaming is intentionally avoided to keep tree replacement deterministic.
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
