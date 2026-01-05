# Contributing to Tree Markdown Parser

Thank you for considering contributing to the Tree Markdown Parser project! We welcome contributions from the community to improve the project.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue on GitHub with the following information:

- A clear and descriptive title.
- Steps to reproduce the bug.
- Expected behavior.
- Actual behavior.
- Any relevant screenshots or logs.

### Suggesting Enhancements

If you have an idea for an enhancement, please open an issue with:

- A clear and descriptive title.
- A detailed description of the enhancement.
- Any relevant examples or use cases.

### Submitting Pull Requests

We encourage you to submit pull requests for bug fixes, enhancements, or new features.

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Write clear, concise, and well-documented code.
4. Add tests for your changes.
5. Run the existing tests to ensure nothing is broken.
6. Submit a pull request with a descriptive title and detailed description.

## Contributing Guidelines

### What Belongs Here

Contributions are welcome for work that strengthens the core mission of the project, including:

- Improvements to tree parsing correctness, edge cases, or error handling
- New renderers (HTML, Mermaid, or plain text)
- CLI usability, flags, and export workflows
- Documentation improvements (README, examples, guides)
- Additional test coverage for real‑world tree inputs
- Integrations with Markdown or editor ecosystems (remark, markdown‑it, VS Code, etc.)

Changes should respect the existing architecture and keep the parsing and rendering core independent from any specific toolchain.

### What Does _Not_ Belong Here

Please avoid contributions that:

- Introduce JavaScript‑based tree rendering or client‑side runtime logic
- Couple core parsing or rendering logic to a specific Markdown renderer
- Add runtime dependencies to the tree parsing or rendering core
- Re‑implement functionality already handled well by Pandoc or external tools
- Add features that significantly increase complexity without clear, general benefit

If you are unsure whether a change fits the project’s scope, please open an issue for discussion before submitting a pull request.

## Architecture Philosophy

tree-markdown-parser is designed around a few strict principles.

### 1. Tree parsing is the core, everything else is integration

The only hard problem this project solves is parsing and rendering ASCII trees.
All other concerns (Markdown, Pandoc, previews, editors) are treated as adapters
around a small, stable core.

This is why tree parsing lives in `src/tree/`, renderers are pure and stateless,
and CLI tools, plugins, and editor extensions do not contain parsing logic.

### 2. No hidden magic, no implicit behavior

The tool favors explicit steps over clever abstractions.
If something happens (CSS injection, Pandoc flags, HTML transformation),
it should be visible in code and explainable in one sentence.

### 3. Rendering is deterministic and portable

Given the same tree input, the output must be structurally identical,
independent of runtime environment, and free of JavaScript dependencies.

Native HTML elements (`details` / `summary`) are preferred over custom logic.

### 4. CLI orchestration is separate from core logic

The CLI coordinates workflows; it does not own logic.
Anything reusable should live outside `src/cli/`.

### 5. Integrations adapt to ecosystems, not the other way around

remark, markdown-it, Pandoc, and VS Code integrations exist to fit into
their ecosystems without forcing architectural compromises upstream.

## Style and Structure Expectations

Before adding new files or logic, please ensure that changes align with the project's architectural boundaries. Code responsibilities are mapped directly to the repository structure:

```plaintext
src/
├─ tree/        → core parsing logic (ASCII → AST)
├─ renderer/    → pure renderers (HTML, Mermaid, text)
├─ cli/         → orchestration and workflows (no core logic)
├─ remark/      → remark/MDAST adapters
├─ markdown-it/ → markdown-it adapters
tooling/
└─              → command-layer helpers (build, preview, demos)
vscode/
└─              → VS Code extension (Markdown preview integration only)
```

Core logic must never leak into adapters or tooling, and tooling must not contain reusable application logic.

If you are unsure where a change should live, open an issue for discussion before submitting a pull request.

### Style and Intent

This project favors clarity and long‑term maintainability over cleverness. Contributions should be small and focused, addressing a single concern at a time rather than bundling multiple refactors together. Code should read plainly and express intent directly.

Comments are encouraged where they add value, but they should explain _why_ something is done, not restate _what_ the code already makes obvious. Avoid unnecessary abstractions, and keep files cohesive rather than splitting logic into many tiny fragments.

### Tests

Changes that affect parsing behavior must be accompanied by updated or additional tests in the `tests/` directory. Rendering‑only changes generally do not require new tests unless they alter output structure or semantics.

### Pull Requests

Each pull request should address one concern and include a clear description of intent and motivation. Please avoid formatting‑only pull requests unless they have been discussed and agreed upon in advance.

## Code of Conduct

This project follows a simple standard of conduct.

Be respectful, constructive, and professional in all interactions.  
Disagreements are expected, but personal attacks, harassment, or dismissive behavior are not acceptable.

The project maintainer reserves the right to moderate discussions, issues, and pull requests to maintain a productive and welcoming environment.

## License

By contributing, you agree that your contributions will be licensed under the project's license.

---

Thank you for helping make Tree Markdown Parser better!
