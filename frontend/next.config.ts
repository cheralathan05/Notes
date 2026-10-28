import type { NextConfig } from "next";
import path from "path";

// Ensure clean standard NODE_ENV for Next.js build/production
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'production';
}

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
