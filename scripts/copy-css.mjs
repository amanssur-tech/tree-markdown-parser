import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = resolve("src/renderer/tree.css");
const destination = resolve("dist/renderer/tree.css");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
