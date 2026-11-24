import type { NextConfig } from "next";

const config: NextConfig = {
  // packages/core ships TypeScript source; better-sqlite3 is a native module and stays external.
  transpilePackages: ["@continuity/core", "@continuity/mcp"],
  serverExternalPackages: ["better-sqlite3", "@electric-sql/pglite"],
  // One local user; keep dev indicators out of the screenshots.
  devIndicators: false,
};

export default config;
