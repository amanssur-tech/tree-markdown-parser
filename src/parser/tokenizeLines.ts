import { LineToken, ParseOptions } from "../types/tree.js";
import { parseIndentation, resolveOptions } from "../utils/indentation.js";

export function tokenizeLines(
  input: string,
  options?: ParseOptions,
): LineToken[] {
  const resolved = resolveOptions(options);
  const lines = input.split(/\r?\n/);
  const tokens: LineToken[] = [];

  for (const rawLine of lines) {
    if (!rawLine.trim()) {
      continue;
    }

    const { level, content } = parseIndentation(rawLine, resolved);
    const explicitFolder = content.endsWith("/");
    const name = explicitFolder ? content.slice(0, -1).trim() : content.trim();

    if (!name) {
      if (resolved.mode === "strict") {
        throw new Error("Invalid empty node name");
      }
      continue;
    }

    tokens.push({ name, level, explicitFolder });
  }

  return tokens;
}
