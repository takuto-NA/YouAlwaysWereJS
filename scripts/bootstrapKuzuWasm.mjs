import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "..");
const sourceDir = join(projectRoot, "node_modules", "kuzu-wasm");
const publicDir = join(projectRoot, "public", "kuzu-wasm");

const filesToCopy = [
  { src: "index.js", dest: "index.js" },
  { src: "kuzu_wasm_worker.js", dest: "kuzu_wasm_worker.js" },
];

const ensureDirs = () => {
  if (!existsSync(sourceDir)) {
    console.error("kuzu-wasm is not installed. Run `npm install kuzu-wasm` first.");
    process.exit(1);
  }

  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }
};

const copyAssets = () => {
  for (const { src, dest } of filesToCopy) {
    const from = join(sourceDir, src);
    const to = join(publicDir, dest);
    if (!existsSync(from)) {
      console.error(`Missing expected file: ${from}`);
      process.exit(1);
    }

    copyFileSync(from, to);
    console.log(`Copied ${from} -> ${to}`);
  }
};

ensureDirs();
copyAssets();
console.log("Finished copying kuzu-wasm assets into /public/kuzu-wasm.");

