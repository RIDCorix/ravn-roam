#!/usr/bin/env node
/**
 * Dictionary parity gate.
 *
 * R-276 requires that every new or changed string lands in BOTH the zh-TW and the
 * English dictionary, with zh-TW as the default locale. Nothing checked that: a key
 * added to `en.json` alone renders its raw path to a Taiwanese traveler, and typecheck
 * cannot see it because the dictionaries are plain JSON.
 *
 * Three things fail this gate, and each is a bug a reader would hit:
 *   - a key present in one locale and absent in the other → raw key rendered
 *   - an empty string → a blank label where copy was meant to be
 *   - mismatched `{placeholder}` sets → an interpolation that renders literally,
 *     or a value the sentence needed and never receives
 *
 * It deliberately does NOT flag a zh-TW value equal to its English one. Product names,
 * region codes and units legitimately match, and a gate that cries about those gets
 * ignored — which is worse than not having it.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LOCALE = "zh-TW";
const APPS = ["apps/web", "apps/landing"];

/** Flatten to `a.b.c` → value, so a missing key names the path a reader would see. */
function flatten(value, prefix = "", out = new Map()) {
  if (value !== null && typeof value === "object") {
    const entries = Array.isArray(value)
      ? value.map((v, i) => [String(i), v])
      : Object.entries(value);
    for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out.set(prefix, value);
  }
  return out;
}

const placeholders = (v) =>
  typeof v === "string"
    ? new Set(v.match(/\{[a-zA-Z0-9_]+\}/g) ?? [])
    : new Set();

const problems = [];

for (const app of APPS) {
  const dir = join(ROOT, app, "src/i18n/dictionaries");
  const read = (locale) => {
    const path = join(dir, `${locale}.json`);
    return { path, flat: flatten(JSON.parse(readFileSync(path, "utf8"))) };
  };

  const base = read(DEFAULT_LOCALE);
  const other = read("en");
  const where = relative(ROOT, dir);

  for (const key of base.flat.keys()) {
    if (!other.flat.has(key)) problems.push(`${where}: '${key}' is in ${DEFAULT_LOCALE} but missing from en`);
  }
  for (const key of other.flat.keys()) {
    if (!base.flat.has(key)) problems.push(`${where}: '${key}' is in en but missing from ${DEFAULT_LOCALE} (the default locale)`);
  }

  for (const [locale, { flat }] of [[DEFAULT_LOCALE, base], ["en", other]]) {
    for (const [key, value] of flat) {
      if (typeof value === "string" && value.trim() === "") {
        problems.push(`${where}: '${key}' is empty in ${locale}`);
      }
    }
  }

  for (const [key, zhValue] of base.flat) {
    if (!other.flat.has(key)) continue;
    const a = placeholders(zhValue);
    const b = placeholders(other.flat.get(key));
    const only = (x, y) => [...x].filter((p) => !y.has(p));
    const missing = only(a, b);
    const extra = only(b, a);
    if (missing.length || extra.length) {
      problems.push(
        `${where}: '${key}' placeholder mismatch — ${DEFAULT_LOCALE} has ${[...a].join(" ") || "none"}, en has ${[...b].join(" ") || "none"}`,
      );
    }
  }
}

if (problems.length) {
  console.error(`i18n parity: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\nEvery user-visible string lands in both dictionaries; ${DEFAULT_LOCALE} is the default.`);
  process.exit(1);
}

console.log(`i18n parity: ${APPS.length} app(s), ${DEFAULT_LOCALE} and en agree on keys, emptiness and placeholders.`);
