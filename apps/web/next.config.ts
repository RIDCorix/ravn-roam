import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@roam/shared", "@roam/catalog"],
  experimental: {
    // Enables React 19's <ViewTransition> component + per-segment
    // transitionTypes on <Link>. Used for the shared-element morph from
    // the trips list into trip detail and for tab-content crossfades.
    viewTransition: true,
  },
};

export default nextConfig;
