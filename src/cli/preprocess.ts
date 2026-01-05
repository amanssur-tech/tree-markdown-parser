#!/usr/bin/env node
// CLI preprocessing pipeline for tree blocks, plus Pandoc/preview helpers.
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  parse,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { defaultTreeTheme } from "../renderer/defaultTheme.js";
import { renderHTML } from "../renderer/renderHTML.js";
import { renderText } from "../renderer/renderText.js";
import { parseTreeBlock } from "../tree/parseTreeBlock.js";

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

interface PandocRunOptions {
  inputPath: string;
  outputPath?: string;
  format: string;
  extraArgs: string[];
  styles: string[];
  noStyle: boolean;
  verbose: boolean;
  cssPaths?: string[];
  cwd?: string;
}

const fencePattern = /^(`{3,})\s*tree\b.*$/;
const closingPattern = /^(`{3,})\s*$/;

const cssStyleTag = `<style data-tree-markdown="true">\n${defaultTreeTheme}\n</style>`;
const cssLinkTag =
  '<link rel="stylesheet" href="tree.css" data-tree-markdown="true" />';
const cssMarker = 'data-tree-markdown="true"';

const pandocCssPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../renderer/tree.css",
);
const pandocDocCssPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../renderer/tmd-doc.css",
);

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const isPandocMode = Boolean(options.to);
  const isPreviewMode = options.command === "preview";
  validateOptions(options, isPandocMode, isPreviewMode);

  const input = await readInput(options);
  const output = replaceTreeBlocks(input, {
    ...options,
    htmlOnly: isPandocMode || isPreviewMode ? true : options.htmlOnly,
  });

  if (isPreviewMode) {
    await runPreview(options, output);
    return;
  }
  if (isPandocMode) {
    await runPandocMode(options, output);
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

function hasPandocCssArg(args: string[]): boolean {
  return args.includes("-c") || args.includes("--css");
}

function hasStandaloneArg(args: string[]): boolean {
  return args.includes("-s") || args.includes("--standalone");
}

function hasEmbedResourcesArg(args: string[]): boolean {
  return (
    args.includes("--embed-resources") ||
    args.includes("--self-contained") ||
    args.some((arg) => arg.startsWith("--embed-resources="))
  );
}

function defaultPandocOutput(inputPath: string, format: string): string {
  const parsed = parse(inputPath);
  return join(parsed.dir, `${parsed.name}.${format}`);
}

async function runPandoc(options: PandocRunOptions): Promise<void> {
  const args = [options.inputPath, "--to", options.format];
  if (!options.noStyle) {
    const baseCss = options.cssPaths ?? [pandocDocCssPath, pandocCssPath];
    for (const cssPath of baseCss) {
      args.push("-c", cssPath);
    }
    for (const style of options.styles) {
      args.push("-c", style);
    }
  }
  args.push(...options.extraArgs);
  if (options.format === "pdf" && !hasPdfEngineArg(options.extraArgs)) {
    // Prefer WeasyPrint for consistent CSS support in PDFs.
    args.push("--pdf-engine=weasyprint");
  }
  if (options.format === "html" && !hasStandaloneArg(options.extraArgs)) {
    args.push("--standalone");
  }
  if (options.format === "html" && !hasEmbedResourcesArg(options.extraArgs)) {
    args.push("--embed-resources");
  }
  if (options.outputPath && !hasPandocOutputArg(options.extraArgs)) {
    args.push("-o", options.outputPath);
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn("pandoc", args, {
      stdio: options.verbose ? "inherit" : ["inherit", "inherit", "pipe"],
      cwd: options.cwd,
    });
    if (!options.verbose && child.stderr) {
      const chunks: Buffer[] = [];
      child.stderr.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      child.stderr.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const filtered = text
          .split(/\r?\n/)
          .filter((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
              return false;
            }
            if (trimmed.startsWith("WARNING: Ignored")) {
              return false;
            }
            if (
              trimmed.startsWith("WARNING: Invalid or unsupported selector")
            ) {
              return false;
            }
            if (trimmed.startsWith("WARNING: Expected a media type, got")) {
              return false;
            }
            if (trimmed.startsWith("WARNING: Invalid media type")) {
              return false;
            }
            return true;
          })
          .join("\n");
        if (filtered) {
          process.stderr.write(`${filtered}\n`);
        }
      });
    }
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
        if (options.format === "pdf" && !hasPdfEngineArg(options.extraArgs)) {
          rejectPromise(
            new Error(
              "Pandoc failed. For PDF output, install WeasyPrint or pass --pdf-engine to Pandoc (e.g. -- --pdf-engine=weasyprint).",
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

function openUrl(url: string): void {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    return;
  }
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], {
      stdio: "ignore",
      detached: true,
    }).unref();
    return;
  }
  spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

function resolvePreviewPath(root: string, urlPath: string): string | null {
  const safePath = normalize(decodeURIComponent(urlPath)).replace(/^\/+/, "");
  const fullPath = join(root, safePath);
  if (!fullPath.startsWith(root)) {
    return null;
  }
  return fullPath;
}

function contentTypeFor(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  return "application/octet-stream";
}

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

async function readInput(options: CliOptions): Promise<string> {
  if (options.input) {
    return readFile(options.input, "utf8");
  }
  return readStdin();
}

async function runPreview(options: CliOptions, output: string): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "tmd-preview-"));
  const tempPath = join(tempDir, "tmd-preprocessed.md");
  const htmlPath = join(tempDir, "preview.html");
  const cssPaths: string[] = [];
  let cleaned = false;
  const cleanup = async (): Promise<void> => {
    if (cleaned) return;
    cleaned = true;
    await rm(tempDir, { recursive: true, force: true });
  };
  try {
    await writeFile(tempPath, output, "utf8");
    if (!options.noStyle) {
      const docCssName = basename(pandocDocCssPath);
      const treeCssName = basename(pandocCssPath);
      await copyFile(pandocDocCssPath, join(tempDir, docCssName));
      await copyFile(pandocCssPath, join(tempDir, treeCssName));
      cssPaths.push(docCssName, treeCssName);
      for (const style of options.styles) {
        const name = basename(style);
        await copyFile(style, join(tempDir, name));
        cssPaths.push(name);
      }
    }
    await runPandoc({
      inputPath: tempPath,
      outputPath: htmlPath,
      format: "html",
      extraArgs: options.pandocArgs,
      styles: [],
      noStyle: options.noStyle,
      verbose: options.verbose,
      cssPaths,
      cwd: tempDir,
    });
    await startPreviewServer(tempDir, basename(htmlPath));
    const onSignal = async (): Promise<void> => {
      await cleanup();
      process.exit(0);
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    process.on("beforeExit", cleanup);
  } catch (err) {
    await cleanup();
    throw err;
  }
}

async function runPandocMode(
  options: CliOptions,
  output: string,
): Promise<void> {
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
    await runPandoc({
      inputPath: tempPath,
      outputPath,
      format,
      extraArgs: options.pandocArgs,
      styles: options.styles,
      noStyle: options.noStyle,
      verbose: options.verbose,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function startPreviewServer(root: string, entry: string): Promise<void> {
  const server = createServer(async (req, res) => {
    const requestPath = req.url === "/" ? entry : (req.url ?? "/");
    const filePath = resolvePreviewPath(root, requestPath);
    if (!filePath) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise<void>((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      resolvePromise();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start preview server");
  }
  const url = `http://127.0.0.1:${address.port}/${entry}`;
  process.stdout.write(`Preview: ${url}\n`);
  openUrl(url);
}
