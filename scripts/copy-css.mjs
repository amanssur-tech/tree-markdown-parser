// Build step: ship CSS alongside compiled JS outputs.
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  {
    source: resolve("src/renderer/tree.css"),
    destination: resolve("dist/renderer/tree.css"),
  },
  {
    source: resolve("src/renderer/tmd-doc.css"),
    destination: resolve("dist/renderer/tmd-doc.css"),
  },
];

for (const { source, destination } of sources) {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}
