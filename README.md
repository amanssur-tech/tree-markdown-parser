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
The source styles live in `src/renderer/tree.css` and `src/renderer/tmd-doc.css` if you want to inspect class names or customize.

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

VS Code’s built-in Markdown preview ignores inline `<style>` tags. Without the extension, use the `markdown.styles` setting to load the CSS file:

```json
{
  "markdown.styles": ["/absolute/path/to/tree.css"]
}
```

## Markdown-it plugin

```ts
import MarkdownIt from "markdown-it";
import markdownItTree from "tree-markdown-parser/markdown-it";

const md = new MarkdownIt({ html: true }).use(markdownItTree);
```

The markdown-it plugin can be used in markdown-it based pipelines.
VS Code’s built-in Markdown preview requires a VS Code extension to load custom plugins.

For VS Code preview integration, use the extension in `vscode/`. It injects `tree.css` and swaps fenced `tree` blocks in the preview using a preview script.

## Local preview

To render a Markdown file to HTML locally (browser preview), run:

```bash
pnpm preview
```

To build, open, and rebuild the HTML on every Markdown change (browser preview), run:

```bash
pnpm dev
```

## CLI Preprocessor

Replace fenced ```tree blocks with rendered HTML:

```bash
tmd -i README.md -o README.rendered.md
```

The preprocessor injects an inline `<style>` tag at the top of the output and adds a `<link rel="stylesheet" href="tree.css" />` fallback (unless one already exists).
For GitHub or other renderers that strip CSS and show `<style>` as text, use `--html-only` to emit HTML without CSS injection.

How to use it:

- If your Markdown previewer supports inline `<style>` blocks, you are done. The output renders without extra files.
- If your previewer strips inline styles, copy `tree.css` next to the output file (or update the link to your preferred path).

Custom styling:

- Edit the inline `<style>` block in the output Markdown, or
- Edit `tree.css` if your previewer only allows linked stylesheets.

If you need SVG/PNG output of a tree (e.g. for embedding into markdown files that don’t support HTML), copy the rendered HTML + CSS into a standalone HTML file and export via Pandoc, Playwright, or your browser’s print/export tools.

Render trees as plain text instead:

```bash
tmd --text < README.md > README.rendered.md
```

Render HTML without any CSS injection (recommended for GitHub):

```bash
tmd --html-only -i README.md -o README.rendered.md
```

### Pandoc integration

Run Pandoc through `tmd` with automatic preprocessing and CSS:

```bash
tmd README.md --to html
tmd README.md --to pdf -o README.pdf
```

Notes:

- Replace `html` with any Pandoc-supported format (pdf, docx, latex, etc.).
- `-o/--output` is optional for any format; the default is the same folder/name with the new extension.
- `tmd --to pdf` defaults to `--pdf-engine=weasyprint` for HTML-based PDFs.
- PDF output requires both Pandoc and WeasyPrint to be installed.
- Install Pandoc:
  - macOS (brew): `brew install pandoc`
  - Ubuntu/Debian (apt): `sudo apt install pandoc`
  - Windows (winget): `winget install Pandoc.Pandoc`
- Install WeasyPrint:
  - macOS (brew): `brew install weasyprint`
  - Ubuntu/Debian (apt): `sudo apt install weasyprint`
  - Windows (winget): `winget install weasyprint`
- By default, Pandoc runs with `-c tmd-doc.css -c tree.css` to style general Markdown and trees.
- Use `--style path/to/custom.css` to append your own stylesheet after the defaults (your styles win).
- Use `--no-style` for fully unstyled output (no CSS passed to Pandoc).
- CSS warnings from WeasyPrint are filtered by default; pass `--verbose` to show all warnings.
- Extra Pandoc flags can be passed after `--`, for example: `tmd README.md --to pdf -- --pdf-engine=weasyprint`.

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
