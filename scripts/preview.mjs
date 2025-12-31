import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkTreeMarkdown from "../dist/remark/remarkTreeMarkdown.js";
import { defaultTreeTheme } from "../dist/index.js";

const inputPath = process.argv[2] ?? "demo/demo.md";
const outputPath = process.argv[3] ?? "demo-preview.html";

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
