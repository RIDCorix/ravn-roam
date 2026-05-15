import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: false,
  dts: false,
  // Bundle workspace packages into the output. Without this, tsup leaves
  // `import "@roam/catalog"` external; at runtime Node ESM resolves it to
  // packages/catalog/src/index.ts which uses extensionless re-exports
  // (`./types`) — illegal in pure ESM, so the container crashes on
  // startup. Bundling sidesteps the whole class of "monorepo dep + ESM
  // resolution" issues for the deployed binary.
  noExternal: [/^@roam\//],
});
