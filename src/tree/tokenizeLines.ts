// Tokenize raw tree text into normalized line tokens, preserving strict/tolerant intent.
import { parseIndentation, resolveOptions } from "./indentation.js";
import { TreeParseError } from "./errors.js";
import { LineToken, ParseOptions } from "./types.js";

export function tokenizeLines(
  input: string,
  options?: ParseOptions,
): LineToken[] {
  const resolved = resolveOptions(options);
  const lines = input.split(/\r?\n/);
  const tokens: LineToken[] = [];

  lines.forEach((rawLine, index) => {
    if (!rawLine.trim()) {
      return;
    }

    const lineNumber = index + 1;
    const { level, content } = parseIndentation(rawLine, resolved, lineNumber);
    const explicitFolder = content.endsWith("/");
    const name = explicitFolder ? content.slice(0, -1).trim() : content.trim();

    if (!name) {
      // In strict mode, an empty label is almost always a copy/paste error.
      if (resolved.mode === "strict") {
        throw new TreeParseError("Invalid empty node name", lineNumber);
      }
      return;
    }

    tokens.push({ name, level, explicitFolder, line: lineNumber });
  });

  return tokens;
}
