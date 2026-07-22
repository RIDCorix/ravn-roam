#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const errors = [];
const warnings = [];
const notes = [];

function read(file) {
  return readFileSync(path.join(root, file), "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function requireFile(file, purpose) {
  if (!existsSync(path.join(root, file))) {
    errors.push(`Missing ${file} (${purpose}).`);
  }
}

function scriptMustExist(packageFile, scriptName) {
  const pkg = readJson(packageFile);
  if (!pkg.scripts?.[scriptName]) {
    errors.push(`${packageFile} is missing scripts.${scriptName}.`);
  }
}

function walk(dir, files = []) {
  const ignored = new Set([
    ".git",
    ".claude",
    ".codex",
    ".next",
    ".pnpm",
    ".turbo",
    ".venv",
    ".vercel",
    ".playwright-cli",
    "coverage",
    "dist",
    "node_modules",
    "out",
    "tmp",
  ]);
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(rel, files);
    } else {
      files.push(rel);
    }
  }
  return files;
}

function countLines(file) {
  return read(file).split(/\r?\n/).length;
}

function extractNextDevPort(packageFile) {
  const command = readJson(packageFile).scripts?.dev ?? "";
  return command.match(/--port\s+(\d+)/)?.[1] ?? null;
}

function extractPlaywrightDefaultPort(configFile) {
  const source = read(configFile);
  return source.match(/WEB_PORT\s+\?\?\s+["'](\d+)["']/)?.[1] ?? null;
}

requireFile("AGENTS.md", "agent operating manual");
requireFile("docs/AGENT_NATIVE.md", "agent-native development rubric");
requireFile("docs/ARCHITECTURE.md", "system boundaries");
requireFile("docs/DEVELOPMENT.md", "local commands and verification");
requireFile("docs/INFRA.md", "infra and credential constraints");
requireFile(".agents/skills/roam-storefront-ui/SKILL.md", "storefront agent skill");
requireFile(".agents/skills/roam-api-catalog/SKILL.md", "API/catalog agent skill");
requireFile(".agents/skills/roam-infra-release/SKILL.md", "infra/release agent skill");

for (const scriptName of [
  "clean:generated",
  "verify",
  "verify:ci",
  "verify:web",
  "verify:api",
  "verify:catalog",
  "verify:lumi-agent",
  "agent:audit",
]) {
  scriptMustExist("package.json", scriptName);
}

const webPort = extractNextDevPort("apps/web/package.json");
const playwrightPort = extractPlaywrightDefaultPort("apps/web/playwright.config.ts");
if (webPort && playwrightPort && webPort !== playwrightPort) {
  errors.push(
    `apps/web dev port (${webPort}) differs from Playwright default (${playwrightPort}).`,
  );
}

const gitignore = existsSync(path.join(root, ".gitignore")) ? read(".gitignore") : "";
const agents = existsSync(path.join(root, "AGENTS.md")) ? read("AGENTS.md") : "";
if (/^\/\.codex\/$/m.test(gitignore) && /project-level Codex config/i.test(agents)) {
  errors.push(
    "AGENTS.md describes tracked project-level Codex config, but /.codex/ is ignored.",
  );
}

const codeFiles = walk(".").filter((file) =>
  /\.(ts|tsx|js|jsx|mjs|py)$/.test(file),
);
const testFiles = codeFiles.filter((file) =>
  /(^|\/)(test_[^/]+\.py|[^/]+\.(test|spec)\.(ts|tsx|js|jsx))$/.test(file),
);
const oversized = codeFiles
  .map((file) => ({ file, lines: countLines(file) }))
  .filter(({ lines }) => lines > 1000)
  .sort((a, b) => b.lines - a.lines)
  .slice(0, 12);

if (oversized.length > 0) {
  warnings.push(
    `Large files over 1000 lines increase agent edit risk:\n${oversized
      .map(({ file, lines }) => `  - ${file}: ${lines}`)
      .join("\n")}`,
  );
}

const eslintDisableCount = codeFiles.reduce((count, file) => {
  const matches = read(file).match(/eslint-disable/g);
  return count + (matches?.length ?? 0);
}, 0);
if (eslintDisableCount > 0) {
  warnings.push(`${eslintDisableCount} eslint-disable comments found; keep each justified.`);
}

notes.push(`${codeFiles.length} code files scanned.`);
notes.push(`${testFiles.length} test/spec files found.`);

console.log("Agent-native audit");
console.log("==================");
for (const note of notes) console.log(`note: ${note}`);
for (const warning of warnings) console.log(`warning: ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`error: ${error}`);
  process.exit(1);
}
console.log("blocking issues: 0");
