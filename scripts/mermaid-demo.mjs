import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { parseTreeBlock, renderMermaid } from "../dist/index.js";

const argv = process.argv.slice(2);
const args = new Set(argv);
const inputIndex = argv.indexOf("--input");
const inputPath =
  inputIndex >= 0 && argv[inputIndex + 1]
    ? argv[inputIndex + 1]
    : "demo/demo.md";
const shouldOpen = args.has("--open");

const markdown = await readFile(resolve(inputPath), "utf8");
const treeBlockMatch = markdown.match(/```tree\s*([\s\S]*?)```/);
if (!treeBlockMatch) {
  throw new Error(`No \`\`\`tree block found in ${inputPath}`);
}

const tree = parseTreeBlock(treeBlockMatch[1] ?? "");
const mermaid = renderMermaid(tree);
process.stdout.write(`${mermaid}\n`);

const state = {
  code: mermaid,
  mermaid: { theme: "default" },
  autoSync: true,
  updateEditor: true,
};

const json = JSON.stringify(state);
const compressed = deflateSync(Buffer.from(json, "utf8"));
const base64 = compressed
  .toString("base64")
  .replaceAll("+", "-")
  .replaceAll("/", "_")
  .replace(/=+$/, "");
const url = `https://mermaid.live/edit#pako:${base64}`;

if (shouldOpen) {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true }).unref();
  } else if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], {
      stdio: "ignore",
      detached: true,
    }).unref();
  } else {
    spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
  }
}

process.stdout.write(`Mermaid Live: ${url}\n`);
