import { ParseOptions, ParseMode } from "../types/tree.js";

export interface ResolvedOptions {
  mode: ParseMode;
  tabWidth: number;
  indentWidth: number;
}

export interface IndentParseResult {
  level: number;
  content: string;
}

export function resolveOptions(options?: ParseOptions): ResolvedOptions {
  return {
    mode: options?.mode ?? "tolerant",
    tabWidth: options?.tabWidth ?? 2,
    indentWidth: options?.indentWidth ?? 2,
  };
}

function throwIfStrict(mode: ParseMode, message: string): void {
  if (mode === "strict") {
    throw new Error(message);
  }
}

export function parseIndentation(
  rawLine: string,
  options: ResolvedOptions,
): IndentParseResult {
  let line = rawLine;
  let idx = 0;
  let hasTab = false;
  let hasSpace = false;

  while (idx < line.length && (line[idx] === " " || line[idx] === "\t")) {
    if (line[idx] === "\t") {
      hasTab = true;
    } else {
      hasSpace = true;
    }
    idx += 1;
  }

  if (hasTab && hasSpace) {
    throwIfStrict(options.mode, "Mixed tabs and spaces in indentation");
  }

  if (hasTab) {
    const leading = line
      .slice(0, idx)
      .replace(/\t/g, " ".repeat(options.tabWidth));
    line = leading + line.slice(idx);
    idx = leading.length;
  }

  let level = 0;
  let cursor = 0;

  while (cursor < line.length) {
    if (line[cursor] === "│") {
      cursor += 1;
      let spaceCount = 0;
      while (cursor < line.length && line[cursor] === " ") {
        spaceCount += 1;
        cursor += 1;
      }
      if (spaceCount === 0) {
        throwIfStrict(
          options.mode,
          "Invalid tree prefix after vertical connector",
        );
      }
      level += 1;
      continue;
    }

    if (line[cursor] === " ") {
      let spaceCount = 0;
      while (cursor < line.length && line[cursor] === " ") {
        spaceCount += 1;
        cursor += 1;
      }
      if (spaceCount % options.indentWidth !== 0) {
        throwIfStrict(options.mode, "Indentation not aligned to indentWidth");
      }
      level += Math.floor(spaceCount / options.indentWidth);
      continue;
    }

    break;
  }

  let sawBranch = false;
  if (line[cursor] === "├" || line[cursor] === "└") {
    sawBranch = true;
    cursor += 1;
    while (line[cursor] === "─" || line[cursor] === "-") {
      cursor += 1;
    }
    if (line[cursor] === " ") {
      cursor += 1;
    }
  }

  if (sawBranch) {
    level += 1;
  }

  const content = line.slice(cursor).trim();

  if (!content) {
    throwIfStrict(options.mode, "Empty tree line");
  }

  return { level, content };
}
