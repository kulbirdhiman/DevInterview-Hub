import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle in .next/standalone so the Docker
  // production image can run without node_modules or the full source tree.
  output: "standalone",
};

export default nextConfig;
