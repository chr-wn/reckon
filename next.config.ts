import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (the embedded local-dev database) ships WASM + data files that must be
  // loaded by Node at runtime rather than bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
