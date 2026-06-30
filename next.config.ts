import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Next doesn't pick up an unrelated
  // lockfile in a parent directory (e.g. the user's home folder).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
