import { ParseOptions, ParseMode } from "../types/tree.js";
import { TreeParseError } from "../types/errors.js";

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

function throwIfStrict(mode: ParseMode, error: Error | string): void {
  if (mode !== "strict") {
    return;
  }
  if (typeof error === "string") {
    throw new TypeError(error);
  }
  throw error;
}

function normalizeIndentation(
  rawLine: string,
  options: ResolvedOptions,
  lineNumber: number,
): string {
  let idx = 0;
  let hasTab = false;
  let hasSpace = false;

  while (
    idx < rawLine.length &&
    (rawLine[idx] === " " || rawLine[idx] === "\t")
  ) {
    if (rawLine[idx] === "\t") {
      hasTab = true;
    } else {
      hasSpace = true;
    }
    idx += 1;
  }

  if (hasTab && hasSpace) {
    throwIfStrict(
      options.mode,
      new TreeParseError("Mixed tabs and spaces in indentation", lineNumber),
    );
  }

  if (!hasTab) {
    return rawLine;
  }

  const leading = rawLine
    .slice(0, idx)
    .replaceAll("\t", " ".repeat(options.tabWidth));
  return leading + rawLine.slice(idx);
}

function readIndentUnits(
  line: string,
  options: ResolvedOptions,
  lineNumber: number,
): { level: number; cursor: number } {
  let level = 0;
  let cursor = 0;

  const readSpaces = (): number => {
    let spaceCount = 0;
    while (cursor < line.length && line[cursor] === " ") {
      spaceCount += 1;
      cursor += 1;
    }
    return spaceCount;
  };

  const consumePipeIndent = (): boolean => {
    cursor += 1;
    const spaceCount = readSpaces();
    if (spaceCount === 0) {
      throwIfStrict(
        options.mode,
        new TreeParseError(
          "Invalid tree prefix after vertical connector",
          lineNumber,
        ),
      );
    }
    return true;
  };

  const consumeSpaceIndent = (): number => {
    const spaceCount = readSpaces();
    if (spaceCount % options.indentWidth !== 0) {
      throwIfStrict(
        options.mode,
        new TreeParseError(
          "Indentation not aligned to indentWidth",
          lineNumber,
        ),
      );
    }
    return Math.floor(spaceCount / options.indentWidth);
  };

  while (cursor < line.length) {
    if (line[cursor] === "│") {
      if (consumePipeIndent()) {
        level += 1;
      }
      continue;
    }

    if (line[cursor] === " ") {
      level += consumeSpaceIndent();
      continue;
    }

    break;
  }

  return { level, cursor };
}

function readBranchPrefix(
  line: string,
  cursor: number,
): { levelBoost: number; cursor: number } {
  if (line[cursor] !== "├" && line[cursor] !== "└") {
    return { levelBoost: 0, cursor };
  }

  let next = cursor + 1;
  while (line[next] === "─" || line[next] === "-") {
    next += 1;
  }
  if (line[next] === " ") {
    next += 1;
  }

  return { levelBoost: 1, cursor: next };
}

export function parseIndentation(
  rawLine: string,
  options: ResolvedOptions,
  lineNumber: number,
): IndentParseResult {
  const line = normalizeIndentation(rawLine, options, lineNumber);
  const indent = readIndentUnits(line, options, lineNumber);
  const branch = readBranchPrefix(line, indent.cursor);
  const level = indent.level + branch.levelBoost;
  const cursor = branch.cursor;
  const content = line.slice(cursor).trim();

  if (!content) {
    throwIfStrict(
      options.mode,
      new TreeParseError("Empty tree line", lineNumber),
    );
  }

  return { level, content };
}
