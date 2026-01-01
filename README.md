# tree-markdown-parser

Parse fenced `tree` blocks into an AST and render rich HTML (plus optional Mermaid and text outputs).

## Install

```bash
pnpm i tree-markdown-parser
```

## Usage

```ts
import { parseTreeBlock, renderHTML } from "tree-markdown-parser";

const input = `src/
├─ app/
│  ├─ page.tsx
│  └─ layout.tsx`;

const tree = parseTreeBlock(input, { mode: "tolerant" });
const html = renderHTML(tree);
```

## HTML Rendering

```ts
import { renderHTML, defaultTreeTheme } from "tree-markdown-parser";

const html = renderHTML(tree);

const page = `
<style>
${defaultTreeTheme}
</style>
${html}
`;
```

Note: folders with children render as native `<details>/<summary>` elements, so they are collapsible by default and should work in most Markdown/PDF renderers without JavaScript.

## Static CSS

You can link the default theme directly as a published asset.
For local builds, the stylesheet is emitted to `dist/renderer/tree.css`.

```html
<link rel="stylesheet" href="tree-markdown-parser/tree.css" />
```

## Remark plugin

```ts
import remarkTreeMarkdown from "tree-markdown-parser/remark";
import rehypeRaw from "rehype-raw";
import remark from "remark";

remark().use(remarkTreeMarkdown).use(rehypeRaw);
```

The plugin transforms fenced ```tree blocks into HTML.
Depending on your pipeline, you may need `rehype-raw` enabled to allow raw HTML.
Include the stylesheet manually as shown above.

VS Code’s built-in Markdown preview ignores inline `<style>` tags, so use the `markdown.styles` setting to load the CSS file:

```json
{
  "markdown.styles": ["/absolute/path/to/tree.css"]
}
```

To preview a Markdown file locally with the plugin, run:

```bash
pnpm preview
```

To build, open, and rebuild on every change to the Markdown file, run:

```bash
pnpm dev
```

## CLI Preprocessor

Replace fenced ```tree blocks with rendered HTML:

```bash
tmd -i README.md -o README.rendered.md
```

Render trees as plain text instead:

```bash
tmd --text < README.md > README.rendered.md
```

## API

- `parseTreeBlock(input, options)` -> `TreeNode[]`
- `renderHTML(nodes)` -> HTML string
- `renderMermaid(nodes)` -> Mermaid `graph TD`
- `renderText(nodes)` -> plain text

## Options

```ts
{
  mode?: "strict" | "tolerant"
  tabWidth?: number
  indentWidth?: number
}
```

## License

MIT
