/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  output: 'export',
  basePath: '/world-sim',
  assetPrefix: '/world-sim',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default config;
