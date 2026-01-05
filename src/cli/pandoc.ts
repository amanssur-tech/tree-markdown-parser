/**
 * Pandoc integration layer for tmd.
 *
 * Responsibilities:
 * - Invoke Pandoc with sane defaults for HTML/PDF exports
 * - Inject tmd styles (document + tree) in a predictable order
 * - Provide a local HTML preview server for preprocessed Markdown
 * - Hide known, harmless WeasyPrint CSS warnings by default
 *
 * This file intentionally owns all process spawning, temp files,
 * and preview infrastructure. No Markdown or tree parsing logic
 * lives here.
 */
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

export interface PandocRunOptions {
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

export interface PreviewOptions {
  pandocArgs: string[];
  styles: string[];
  noStyle: boolean;
  verbose: boolean;
}

export interface PandocExportOptions {
  inputPath?: string;
  outputPath?: string;
  format: string;
  pandocArgs: string[];
  styles: string[];
  noStyle: boolean;
  verbose: boolean;
}

const pandocCssPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../renderer/tree.css",
);
const pandocDocCssPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../renderer/tmd-doc.css",
);

export function defaultPandocOutput(inputPath: string, format: string): string {
  const parsed = parse(inputPath);
  return join(parsed.dir, `${parsed.name}.${format}`);
}

export async function runPreview(
  options: PreviewOptions,
  output: string,
): Promise<void> {
  // Preview runs from a temporary directory to:
  // - avoid mutating user files
  // - allow Pandoc to resolve relative CSS paths
  // - ensure a clean, disposable environment
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

export async function runPandocExport(
  options: PandocExportOptions,
  output: string,
): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "tmd-"));
  const tempPath = join(tempDir, "tmd-preprocessed.md");
  try {
    await writeFile(tempPath, output, "utf8");
    let outputPath = options.outputPath;
    if (!outputPath) {
      if (!options.inputPath) {
        throw new Error("Provide --output when using stdin with --to");
      }
      outputPath = defaultPandocOutput(options.inputPath, options.format);
    }
    await runPandoc({
      inputPath: tempPath,
      outputPath,
      format: options.format,
      extraArgs: options.pandocArgs,
      styles: options.styles,
      noStyle: options.noStyle,
      verbose: options.verbose,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function runPandoc(options: PandocRunOptions): Promise<void> {
  const args = [options.inputPath, "--to", options.format];
  if (!options.noStyle) {
    // CSS order matters:
    // 1. tmd-doc.css   → baseline Markdown styling
    // 2. tree.css      → tree-specific styling
    // 3. user styles   → always win
    const baseCss = options.cssPaths ?? [pandocDocCssPath, pandocCssPath];
    for (const cssPath of baseCss) {
      args.push("-c", cssPath);
    }
    for (const style of options.styles) {
      args.push("-c", style);
    }
  }
  args.push(...options.extraArgs);
  // Prefer WeasyPrint for consistent, HTML-based PDF rendering.
  // Pandoc defaults to LaTeX, which ignores CSS and breaks trees.
  if (options.format === "pdf" && !hasPdfEngineArg(options.extraArgs)) {
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
    // By default, filter known WeasyPrint CSS warnings that are harmless
    // (unsupported properties, vendor selectors, etc).
    // Real Pandoc errors and non-zero exits are still surfaced.
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

export function hasPandocCssArg(args: string[]): boolean {
  return args.includes("-c") || args.includes("--css");
}

function hasPandocOutputArg(args: string[]): boolean {
  return args.includes("-o") || args.includes("--output");
}

function hasPdfEngineArg(args: string[]): boolean {
  return args.some((arg) => arg.startsWith("--pdf-engine"));
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

function resolvePreviewPath(root: string, urlPath: string): string | null {
  const safePath = normalize(decodeURIComponent(urlPath)).replace(/^\/+/, "");
  const fullPath = join(root, safePath);
  // Prevent directory traversal outside the preview root
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
