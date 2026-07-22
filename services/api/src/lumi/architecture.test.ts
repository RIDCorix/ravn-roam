import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Lumi provider module boundaries", () => {
  test("keeps openai.ts as a composition entry below the domain-core budget", () => {
    const source = readFileSync(new URL("./openai.ts", import.meta.url), "utf8");
    expect(source.split("\n").length).toBeLessThan(650);
    expect(source).toContain('from "./provider/tool-contracts.js"');
    expect(source).toContain('from "./provider/command-adapter.js"');
    expect(source).toContain('from "./validation/drafts.js"');
    for (const forbiddenOwnership of [
      /const responseSchema\s*=/,
      /const .*JSON_SCHEMA\s*=/,
      /function executeLumiActionTool\s*\(/,
      /function anchorContractIssue\s*\(/,
      /lumiCommandSchema\.safeParse/,
      /z\.object\s*\(/,
    ]) {
      expect(source).not.toMatch(forbiddenOwnership);
    }
  });
});
