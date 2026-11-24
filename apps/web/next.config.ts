import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  // packages/core and apps/mcp ship TypeScript source; better-sqlite3 is a native module and stays external.
  transpilePackages: ["@continuity/core", "@continuity/mcp"],
  serverExternalPackages: ["better-sqlite3", "@electric-sql/pglite"],
  // Hosted (Vercel, Milestone 8): trace from the monorepo root and ship the Postgres migrations with every function.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  outputFileTracingIncludes: { "/**": ["../../packages/core/drizzle-pg/**"] },
  // One local user; keep dev indicators out of the screenshots.
  devIndicators: false,
};

export default config;
