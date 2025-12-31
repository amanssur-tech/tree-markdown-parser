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

## Static CSS

You can link the default theme directly as a published asset.
For local builds, the stylesheet is emitted to `dist/renderer/tree.css`.

```html
<link rel="stylesheet" href="tree-markdown-parser/tree.css" />
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
