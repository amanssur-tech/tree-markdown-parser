import { readFile, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { resolve } from "node:path";
import { exec } from "node:child_process";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkTreeMarkdown from "../dist/remark/remarkTreeMarkdown.js";
import { defaultTreeTheme } from "../dist/index.js";

const argv = process.argv.slice(2);
const args = new Set(argv);
const inputIndex = argv.indexOf("--input");
const outputIndex = argv.indexOf("--output");
const positionalInput = argv.find((arg) => !arg.startsWith("-"));
const inputPath =
  inputIndex >= 0 && argv[inputIndex + 1]
    ? argv[inputIndex + 1]
    : positionalInput || "demo/demo.md";
const outputPath =
  outputIndex >= 0 && argv[outputIndex + 1]
    ? argv[outputIndex + 1]
    : "demo-preview.html";
const shouldOpen = args.has("--open");

const render = async () => {
  const markdown = await readFile(resolve(inputPath), "utf8");

  const file = await remark()
    .use(remarkTreeMarkdown)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(markdown);

  const body = String(file);

  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>tree-markdown-parser preview</title>
    <style>${defaultTreeTheme}</style>
  </head>
  <body>
    ${body}
  </body>
</html>`;

  await writeFile(resolve(outputPath), page, "utf8");
  console.log(`Rendered ${inputPath} -> ${outputPath}`);
};

await render();

if (shouldOpen) {
  const quoted = `"${outputPath}"`;
  let command = `xdg-open ${quoted}`;
  if (process.platform === "darwin") {
    command = `open ${quoted}`;
  } else if (process.platform === "win32") {
    command = `start ${quoted}`;
  }
  exec(command);
}

watch(resolve(inputPath), { persistent: true }, async (eventType) => {
  if (eventType === "change") {
    await render();
  }
});
