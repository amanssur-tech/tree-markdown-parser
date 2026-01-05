# Tree Markdown – VS Code Extension

Render ASCII directory trees correctly in VS Code’s Markdown preview.

This extension detects fenced ```tree blocks and replaces them in the preview with structured, collapsible HTML trees. Your Markdown files are never modified.

<img width="1440" height="900" alt="vsc-extension-dark" src="https://github.com/user-attachments/assets/2713c637-e4f2-465c-abb2-45926452323f" />

## Why this extension exists

By default, VS Code renders ASCII directory trees as plain monospaced text.  
Nesting, indentation guides, and branch structure quickly become hard to read and easy to misinterpret.

This extension turns:

```tree
src/
├─ app/
│  ├─ page.tsx
│  └─ layout.tsx
```

into a clean, structured tree in the Markdown preview, with native folder collapsing and consistent layout:

<img width="792" height="150" alt="Screenshot 2026-01-05 at 23 56 05" src="https://github.com/user-attachments/assets/023febc0-ebee-4818-9edb-6e72fedeadb4" />
<img width="792" height="154" alt="Screenshot 2026-01-05 at 23 56 37" src="https://github.com/user-attachments/assets/9c02412f-ffe2-4b9c-82ae-89635cfb6811" />


## What this extension does

- Detects fenced ```tree blocks in Markdown
- Renders them as structured HTML trees in the preview
- Uses native `<details>/<summary>` elements for collapsing folders
- Injects its own stylesheet into the preview
- Updates live as you edit your Markdown

## What this extension does _not_ do

- It does **not** modify your Markdown files
- It does **not** affect exports (PDF, HTML, etc.)
- It does **not** rely on markdown-it plugins
- It does **not** execute JavaScript inside your documents

The behavior is strictly limited to VS Code’s Markdown preview.

## Usage

1. Install the extension
2. Open a Markdown file
3. Add a fenced `tree` block:

````plaintext
```tree
src/
├─ app/
│  ├─ page.tsx
│  └─ layout.tsx
``` (end of fenced block)
````

1. Open the Markdown preview  
   (`Ctrl+Shift+V` on Windows/Linux, `⌘⇧V` on macOS)

That’s it. The tree renders automatically in the preview.

<img width="1440" height="900" alt="vsc-extension" src="https://github.com/user-attachments/assets/ff9411d0-5582-4b5a-b107-09ce4df91a02" />

## Notes

- Styling is applied only inside the Markdown preview
- Trees use native HTML semantics and require no JavaScript
- Preview updates automatically as the document changes

## Related project

This extension is part of the **tree-markdown-parser** project, which also provides:

- A CLI for preprocessing Markdown files
- Pandoc integration for HTML and PDF exports
- remark and markdown-it plugins for other pipelines

Those features are intentionally out of scope for this VS Code extension.

Repository: <https://github.com/your-org/tree-markdown-parser>
