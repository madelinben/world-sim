/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Only apply GitHub Pages settings in production
  ...(process.env.NODE_ENV === 'production' && {
    output: 'export',
    basePath: '/world-sim',
    assetPrefix: '/world-sim',
    trailingSlash: true,
  }),
  images: {
    unoptimized: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  }
};

export default config;
