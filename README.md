# tree-markdown-parser

Render ASCII directory trees correctly and consistently across previews and exports.

tree-markdown-parser parses fenced `tree` blocks into a structured AST and renders them as collapsible HTML (no JavaScript required). It solves two core problems:

1. Accurate, interactive tree rendering in Markdown previews (CLI preview, plugins, VS Code).
2. Stable, portable tree rendering for exports (HTML, PDF, and other Pandoc-supported formats).

The tool integrates via a CLI, Markdown plugins, and a VS Code extension. Mermaid and plain-text outputs are also available.

<img alt="Before and After" src="https://github.com/user-attachments/assets/1a119a74-0c83-43b5-9e3b-4d93a7cac4f6" style="max-width:100%; height:auto;" />

## Install

```bash
pnpm i tree-markdown-parser
npm i tree-markdown-parser
yarn add tree-markdown-parser
```

Run the CLI without installing:

```bash
npx tree-markdown-parser --help
```

The CLI is exposed as `tmd` after installation. Use `-h/--help` to list all flags and `-v/--version` to print the current version.

## Table of Contents

- **[CLI Usage](#cli-usage)**
- **[Pandoc Integration](#pandoc-integration)**
- **[VS Code Extension](#vs-code-extension)**
- **[Codebase Map](#codebase-map)**
- **[Plugins](#plugins)**
- **[Renderers](#renderers)**
- **[Local Dev Preview](#local-dev-preview)**
- **[Library Usage](#library-usage)**
- **[API](#api)**
- **[Options](#options)**
- **[License](#license)**
- **[Contributing](#contributing)**

## CLI Usage

### Tree Rendering

Format your Markdown with `tmd` to replace fenced ```tree blocks with rendered HTML:

```bash
tmd input.md output.md
tmd -i input.md -o output.md
```

The preprocessor injects an inline `<style>` tag at the top of the output and adds a `<link rel="stylesheet" href="tree.css" />` as a fallback for tools that only support linked stylesheets. In order for the linked stylesheet to work, copy `tree.css` next to the input file or update the link to your preferred stylesheet's path.

Custom styling:

- Edit the inline `<style>` block in the output Markdown, or
- Edit `tree.css` if your previewer only allows linked stylesheets.

If you need **SVG/PNG** output of a tree (e.g. for embedding into markdown files that don’t support HTML), copy your tree's HTML + CSS from the output Markdown into a standalone HTML file and export it via Pandoc, Playwright, or your browser’s print/export tools.

Render trees as **plain text** instead:

```bash
tmd --text input.md output.md
```

For **GitHub** or other renderers that strip CSS and show `<style>` as text, use `--html-only` to emit HTML without CSS injection:

```bash
tmd --html-only input.md output.md
```

### Pandoc integration

Export a markdown file with Pandoc through `tmd` to other formats like html or pdf using automatic preprocessing and CSS. Pandoc renders the document as HTML internally and applies two stylesheets by default:

1. `tmd-doc.css` for general Markdown typography
2. `tree.css` for tree rendering

This provides a clean, readable layout for both the document content and the rendered trees. In order to use Pandoc, you need to install Pandoc on your system.

<img alt="Markdown PDF example" src="https://github.com/user-attachments/assets/23f286ae-1cee-452b-98f1-6ba149bc01f9" style="max-width:100%; height:auto;" />

#### Pandoc installation

- macOS (Homebrew): `brew install pandoc`
- Ubuntu / Debian (apt): `sudo apt install pandoc`
- Windows (winget): `winget install Pandoc.Pandoc`

#### Basic usage

Preview a markdown file in your browser:

```bash
tmd preview input.md
```

Export a markdown to html:

```bash
tmd input.md --to html output.pdf
```

You can replace `html` with any Pandoc-supported output format, such as `pdf`, `docx`, or `latex`:

```bash
tmd input.md --to pdf output.pdf
```

Providing an output file/path is optional. If you don’t provide it, the output is written next to the input file using the same name and the new extension.

When you run `tmd --to pdf`, the tool defaults to an HTML-based PDF pipeline using **WeasyPrint**. This ensures that CSS is applied correctly and consistently. PDF output requires **WeasyPrint** to be installed in addition to Pandoc on your system.

##### WeasyPrint installation

- macOS (Homebrew): `brew install weasyprint`
- Ubuntu / Debian (apt): `sudo apt install weasyprint`
- Windows (winget): `winget install weasyprint`

#### Advanced usage

If you want full control over styling, you can append your own stylesheet using `--style path/to/custom.css`.  
Your stylesheet is applied **after** the defaults, so your rules always win.

If you prefer completely unstyled output, use `--no-style`. This disables all CSS and lets Pandoc produce a raw export.

CSS warnings from WeasyPrint are filtered by default to avoid unnecessary noise. If you want to see everything, pass `--verbose`.

Any additional Pandoc flags can be forwarded after `--`. For example:

```bash
tmd input.md --to pdf -- --pdf-engine=weasyprint
```

## VS Code extension

For the best authoring experience, use the **vscode-tree-markdown** extension to render fenced `tree` blocks automatically in VS Code’s Markdown preview.

The extension works entirely at preview time:

- No files are modified
- No preprocessing is required
- No CLI commands are needed

It injects the tree stylesheet and replaces fenced `tree` blocks in the preview with the same HTML renderer used by the core library.

### Where to get
  
[Visual Studio Marketplace - Tree Markdown Preview](https://marketplace.visualstudio.com/items?itemName=amanssur.vscode-tree-markdown)

### Source

Extension source (in this repo):  
[`/vscode`](./vscode)

### Notes

The extension affects **only the Markdown preview**, not the editor text. For exports (HTML, PDF, etc.), use the `tmd` CLI instead.

## Codebase Map

- `src/` Core library and CLI logic
  - `src/tree/` Tree parsing and normalization (AST construction)
  - `src/renderer/` Output renderers (HTML, Mermaid, text, CSS themes)
  - `src/cli/` CLI preprocessing and Pandoc integration
  - `src/remark/`, `src/markdown-it/` Markdown plugin integrations

- `tooling/` Command-layer helpers invoked by npm scripts  
  (build steps, preview server, demos, CSS emission)

- `tests/` Parsing and structural behavior tests

- `vscode/` VS Code extension for live Markdown preview rendering

## Plugins

### TreeMarkdown plugin (remark/rehype & other MDAST pipelines)

```ts
import TreeMarkdown from "tree-markdown-parser/remark";
import rehypeRaw from "rehype-raw";
import remark from "remark";

remark().use(TreeMarkdown).use(rehypeRaw);
```

The plugin replaces fenced tree code blocks with HTML generated by the core renderer. It does not handle Markdown parsing itself; it only transforms tree blocks. Depending on your pipeline, you may need `rehype-raw` enabled to allow raw HTML.

Note: `TreeMarkdown` is an MDAST transform. If you already have a Markdown AST, you can call it directly (no remark required):

```ts
import TreeMarkdown from "tree-markdown-parser/remark";

const transform = TreeMarkdown();
const nextTree = transform(mdastTree);
```

### Markdown-it plugin

```ts
import MarkdownIt from "markdown-it";
import markdownItTree from "tree-markdown-parser/markdown-it";

const md = new MarkdownIt({ html: true }).use(markdownItTree);
```

The markdown-it plugin can be used in markdown-it based pipelines. VS Code’s built-in Markdown preview requires a VS Code extension to load custom plugins. You may also use the `vscode-tree-markdown` extension which does not depend on markdown-it plugins.

## Renderers

### HTML Rendering

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

### Mermaid Output

```ts
import { parseTreeBlock, renderMermaid } from "tree-markdown-parser";

const tree = parseTreeBlock("src/\n  app/\n    page.tsx");
const mermaid = renderMermaid(tree);
```

Quick demo (prints Mermaid and opens Mermaid Live):

```bash
pnpm mermaid -- --input input.md
```

### Text Output

```ts
import { renderText } from "tree-markdown-parser";

const text = renderText(tree);
```

### Static CSS

You can link the default theme directly as a published asset.
For local builds, the stylesheet is emitted to `dist/renderer/tree.css`.
The source styles live in `src/renderer/tree.css` and `src/renderer/tmd-doc.css` if you want to inspect class names or customize.

```html
<link rel="stylesheet" href="tree-markdown-parser/tree.css" />
```

## Local dev preview

To build, open, and rebuild the HTML on every Markdown change (browser preview), run:

```bash
pnpm dev
```

This currently uses demo/demo.md as the default input. To pass an input file explicitly run:

```bash
pnpm dev -- path-to/your-file.md
```

Note: `pnpm dev` is a development preview focused on the tree block renderer. The rest of the Markdown renders as plain HTML. For a full rich preview of your entire Markdown file, use `tmd preview input.md` or the `vscode-tree-markdown` extension.

## Library Usage

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

This section is for developers who want to use the core library directly (without the CLI or extensions). It shows the small set of functions you can call to parse a tree and render it in different formats.

- `parseTreeBlock(input, options)` -> `TreeNode[]`  
  Parse a fenced tree block string into a structured AST.
- `renderHTML(nodes, { rootClass? })` -> HTML string  
  Render the AST as a `<ul>` tree with optional root class for styling hooks.
- `renderMermaid(nodes)` -> Mermaid `graph TD`  
  Render the AST as a Mermaid flowchart.
- `renderText(nodes)` -> plain text  
  Render the AST as a simple indented list (fallback/debug).

These functions are renderer‑agnostic and can be used independently of Markdown or any preview pipeline.

## Options

These options are for when you’re ingesting real‑world tree text and want to control how strict the parser should be. Use them in CI/docs to enforce consistency (`strict`), or in user‑facing tools where inputs are messy (`tolerant`).

```ts
{
  mode?: "strict" | "tolerant"
  tabWidth?: number
  indentWidth?: number
}
```

Field notes:

- `mode`: `strict` throws on mixed indentation and structural issues; `tolerant` best‑effort recovers.
- `tabWidth`: How many spaces a tab represents when normalizing input.
- `indentWidth`: How many spaces represent one indentation level.

## License

MIT © Amanullah Manssur. See [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome.

If you want to understand the project’s architecture, design principles,
or contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).
