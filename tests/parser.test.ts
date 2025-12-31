import { describe, it, expect } from "vitest";
import { parseTreeBlock } from "../src/index.js";

describe("parseTreeBlock", () => {
  it("parses connector-based trees", () => {
    const input = `src/
├─ app/
│  ├─ page.tsx
│  └─ layout.tsx`;

    const tree = parseTreeBlock(input, { mode: "strict" });

    expect(tree).toHaveLength(1);
    const root = tree.at(0);
    expect(root).toBeDefined();
    if (!root) {
      throw new Error("Expected root node to exist");
    }
    expect(root.name).toBe("src");
    expect(root.type).toBe("folder");
    const app = root.children.at(0);
    expect(app).toBeDefined();
    if (!app) {
      throw new Error("Expected app node to exist");
    }
    expect(app.name).toBe("app");
    expect(app.children).toHaveLength(2);
    const page = app.children.at(0);
    expect(page).toBeDefined();
    if (!page) {
      throw new Error("Expected page node to exist");
    }
    expect(page.type).toBe("file");
  });

  it("parses indentation-only trees", () => {
    const input = `src/
  app/
    page.tsx`;

    const tree = parseTreeBlock(input);

    const root = tree.at(0);
    expect(root).toBeDefined();
    if (!root) {
      throw new Error("Expected root node to exist");
    }
    expect(root.name).toBe("src");
    const app = root.children.at(0);
    expect(app).toBeDefined();
    if (!app) {
      throw new Error("Expected app node to exist");
    }
    expect(app.name).toBe("app");
    const page = app.children.at(0);
    expect(page).toBeDefined();
    if (!page) {
      throw new Error("Expected page node to exist");
    }
    expect(page.name).toBe("page.tsx");
  });

  it("rejects mixed tabs and spaces in strict mode", () => {
    const input = "src/\n\t  app/";
    expect(() => parseTreeBlock(input, { mode: "strict" })).toThrow();
  });

  it("reports line numbers on indentation errors", () => {
    const input = "src/\n\t  app/";
    expect(() => parseTreeBlock(input, { mode: "strict" })).toThrow("Line 2");
  });
});
