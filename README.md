# tree-markdown-parser

Parse fenced `tree` blocks into an AST and render rich HTML (plus optional Mermaid and text outputs).

## Install

```
npm install tree-markdown-parser
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
