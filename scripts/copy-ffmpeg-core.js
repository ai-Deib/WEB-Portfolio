import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(projectRoot, "node_modules", "@ffmpeg", "core", "dist", "esm");
const destination = join(projectRoot, "public", "ffmpeg");

await mkdir(destination, { recursive: true });
await Promise.all(
  ["ffmpeg-core.js", "ffmpeg-core.wasm"].map((file) =>
    copyFile(join(source, file), join(destination, file))),
);
