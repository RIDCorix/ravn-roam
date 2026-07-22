#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const generatedPaths = [
  "apps/web/.next",
  "apps/landing/.next",
  "apps/web/tsconfig.tsbuildinfo",
  "apps/landing/tsconfig.tsbuildinfo",
  "packages/catalog/tsconfig.tsbuildinfo",
  "packages/shared/tsconfig.tsbuildinfo",
  "services/api/tsconfig.tsbuildinfo",
  "services/api/dist",
  "services/lumi-agent/.pytest_cache",
];

let removed = 0;
for (const rel of generatedPaths) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) continue;
  rmSync(abs, { recursive: true, force: true });
  console.log(`removed ${rel}`);
  removed++;
}

if (removed === 0) {
  console.log("no generated artifacts found");
}
