// Bundles the server into dist/bin/server.js for Claude Desktop. better-sqlite3 stays external
// (native module); the core migrations are copied next to the bundle, where openDb looks for them.
import { build } from "esbuild";
import { cpSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/bin/server.js",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  external: ["better-sqlite3"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});
cpSync("../../packages/core/drizzle", "dist/drizzle", { recursive: true });
