import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Linting runs separately via `pnpm lint` (root Makefile's `make lint`);
  // Next's built-in build-time ESLint runner is not compatible with our
  // flat eslint.config.mjs on the eslint/eslint-config-next versions pinned
  // here, so it is disabled here rather than left silently broken.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
