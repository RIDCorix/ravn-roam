import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@roam/shared", "@roam/catalog"],
};

export default nextConfig;
