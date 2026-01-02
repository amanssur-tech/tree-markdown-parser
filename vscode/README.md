# Tree Markdown VS Code Extension

This extension enables fenced `tree` blocks in VS Code’s Markdown preview.

## Development

1. Install dependencies

   ```bash
    pnpm install
   ```

2. Compile

   ```bash
   pnpm compile
   ```

3. Press F5 in VS Code to launch the Extension Development Host.

4. In the Extension Development Host, open a Markdown file that contains fenced ```tree blocks and open the Markdown preview.

## Notes

The extension injects `media/tree.css` and uses `media/preview.js` to replace fenced `tree` blocks in the preview. It does not rely on VS Code loading markdown-it plugins.
