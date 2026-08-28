import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Amvera serves this export through scripts/amvera-server.mjs, which also
  // exposes the server-only PostgreSQL API. Portable builds use the same files.
  output: "export",
  reactStrictMode: true,
};

export default nextConfig;
