// Parsing errors include line numbers to keep tree cleanup fast for users.
export class TreeParseError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(`Line ${line}: ${message}`);
    this.name = "TreeParseError";
    this.line = line;
  }
}
