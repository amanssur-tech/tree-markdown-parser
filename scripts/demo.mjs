import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseTreeBlock, renderHTML, defaultTreeTheme } from "../dist/index.js";

const input = `src/
├─ app/
│  ├─ page.tsx
│  └─ layout.tsx
├─ styles/
│  └─ globals.css
└─ README.md`;

const tree = parseTreeBlock(input, { mode: "tolerant" });
const html = renderHTML(tree);

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>tree-markdown-parser demo</title>
    <style>${defaultTreeTheme}</style>
  </head>
  <body>
    ${html}
  </body>
</html>`;

await writeFile(resolve("demo.html"), page, "utf8");
