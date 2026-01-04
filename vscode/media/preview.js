(() => {
  const parseTreeBlock = (input) => buildTree(tokenizeLines(input));

  const tokenizeLines = (input) => {
    const lines = input.split(/\r?\n/);
    const tokens = [];
    for (const rawLine of lines) {
      if (!rawLine.trim()) continue;
      const { level, content } = parseIndentation(rawLine);
      const explicitFolder = content.endsWith("/");
      const name = explicitFolder
        ? content.slice(0, -1).trim()
        : content.trim();
      if (!name) continue;
      tokens.push({ name, level, explicitFolder });
    }
    return tokens;
  };

  const normalizeIndentation = (rawLine) => {
    let idx = 0;
    while (
      idx < rawLine.length &&
      (rawLine[idx] === " " || rawLine[idx] === "\t")
    ) {
      idx += 1;
    }
    if (!rawLine.slice(0, idx).includes("\t")) {
      return rawLine;
    }
    const leading = rawLine.slice(0, idx).replaceAll("\t", "  ");
    return leading + rawLine.slice(idx);
  };

  const readIndentUnits = (line) => {
    let level = 0;
    let cursor = 0;
    const readSpaces = () => {
      let count = 0;
      while (cursor < line.length && line[cursor] === " ") {
        count += 1;
        cursor += 1;
      }
      return count;
    };

    while (cursor < line.length) {
      if (line[cursor] === "│") {
        cursor += 1;
        const spaceCount = readSpaces();
        if (spaceCount > 0) {
          level += 1;
          continue;
        }
        break;
      }

      if (line[cursor] === " ") {
        const spaceCount = readSpaces();
        level += Math.floor(spaceCount / 2);
        continue;
      }

      break;
    }

    return { level, cursor };
  };

  const readBranchPrefix = (line, cursor) => {
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
  };

  const parseIndentation = (rawLine) => {
    const line = normalizeIndentation(rawLine);
    const indent = readIndentUnits(line);
    const branch = readBranchPrefix(line, indent.cursor);
    const level = indent.level + branch.levelBoost;
    const content = line.slice(branch.cursor).trim();
    return { level, content };
  };

  const isAllCaps = (name) => {
    const trimmed = name.trim();
    const spaceIndex = trimmed.indexOf(" ");
    const parenIndex = trimmed.indexOf("(");
    const splitIndexCandidates = [spaceIndex, parenIndex].filter(
      (index) => index >= 0,
    );
    const splitIndex =
      splitIndexCandidates.length > 0 ? Math.min(...splitIndexCandidates) : -1;
    const prefix = splitIndex >= 0 ? trimmed.slice(0, splitIndex) : trimmed;
    const letters = prefix.replaceAll(/[^A-Za-z]/g, "");
    return letters.length > 0 && letters === letters.toUpperCase();
  };

  const buildTree = (tokens) => {
    const roots = [];
    const stack = [];
    const explicitFolders = new Set();

    for (const token of tokens) {
      let level = token.level;
      if (level > stack.length) {
        level = stack.length;
      }
      while (stack.length > level) {
        stack.pop();
      }
      if (token.explicitFolder) {
        explicitFolders.add(token.name);
      }
      const node = { name: token.name, type: "file", children: [] };
      if (stack.length === 0) {
        roots.push(node);
      } else {
        stack.at(-1).children.push(node);
      }
      stack.push(node);
    }

    const finalize = (node) => {
      const children = node.children.map(finalize);
      if (children.length > 0 || explicitFolders.has(node.name)) {
        return { ...node, type: "folder", children };
      }
      const hasDot = node.name.includes(".");
      return {
        ...node,
        type: hasDot || isAllCaps(node.name) ? "file" : "folder",
        children,
      };
    };

    return roots.map(finalize);
  };

  const escapeHtml = (value) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const renderHTML = (nodes) => {
    const renderNode = (node) => {
      const classes = `tree-node ${node.type}`;
      const label = escapeHtml(node.name);
      const children = node.children.length
        ? `<ul>${node.children.map(renderNode).join("")}</ul>`
        : "";
      if (node.type === "folder") {
        return `<li class="${classes}" data-type="${node.type}"><details open><summary><span class="tree-label">${label}</span></summary>${children}</details></li>`;
      }
      return `<li class="${classes}" data-type="${node.type}"><span class="tree-label">${label}</span>${children}</li>`;
    };
    return `<ul class="tree">${nodes.map(renderNode).join("")}</ul>`;
  };

  const renderText = (nodes) => {
    const lines = [];
    const walk = (node, depth) => {
      const indent = "  ".repeat(depth);
      const label = node.type === "folder" ? `${node.name}/` : node.name;
      lines.push(`${indent}- ${label}`);
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    };
    for (const node of nodes) {
      walk(node, 0);
    }
    return lines.join("\n");
  };

  const replaceBlocks = () => {
    const blocks = document.querySelectorAll(
      "code.language-tree, code.lang-tree",
    );
    blocks.forEach((code) => {
      const pre = code.closest("pre");
      if (!pre || pre.dataset.treeProcessed === "true") return;
      const raw = code.textContent ?? "";
      let tree;
      try {
        tree = parseTreeBlock(raw);
      } catch {
        return;
      }
      let html;
      try {
        html = renderHTML(tree);
      } catch {
        const text = renderText(tree);
        html = `<pre class="tree-text"><code>${escapeHtml(text)}</code></pre>`;
      }
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html;
      pre.replaceWith(wrapper.firstElementChild ?? wrapper);
    });
  };

  const setupObserver = () => {
    let timerId = null;
    const scheduleReplace = () => {
      if (timerId !== null) {
        globalThis.clearTimeout(timerId);
      }
      timerId = globalThis.setTimeout(() => {
        replaceBlocks();
        timerId = null;
      }, 60);
    };
    const observer = new MutationObserver((mutations) => {
      const shouldRefresh = mutations.some(
        (mutation) =>
          mutation.type === "childList" || mutation.type === "characterData",
      );
      if (shouldRefresh) {
        scheduleReplace();
      }
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", replaceBlocks, {
      once: true,
    });
  } else {
    replaceBlocks();
  }
  setupObserver();
})();
