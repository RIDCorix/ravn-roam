import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests only. Playwright owns `e2e/`, so it is excluded here — the two
// runners would otherwise both claim `e2e/*.spec.ts`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
