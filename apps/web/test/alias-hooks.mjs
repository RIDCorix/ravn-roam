/**
 * Module resolve hook for running app source under `node --test`.
 *
 * Node's own type stripping runs plain `.ts` with no build step, but it resolves like
 * Node, not like the bundler the app is written for. Two gaps, both load-bearing:
 *
 *   - the `@/…` tsconfig path alias, which Node does not read. `@/lib/shop-link`
 *     reaches a VALUE import of `@/lib/storefront-destinations`, so without this no
 *     test can import the shop-link chain at all.
 *   - extensionless relative imports (`./storefront-regions`), which Next resolves
 *     and Node ESM does not.
 *
 * `.tsx` is deliberately not resolved: JSX is not strippable, and a test that needs
 * it wants a browser, not this runner.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

const firstExisting = (base) =>
  [base, `${base}.ts`, join(base, "index.ts")].find((candidate) =>
    existsSync(candidate),
  );

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const found = firstExisting(join(SRC, specifier.slice(2)));
    if (!found) throw new Error(`alias '${specifier}' resolved to nothing under ${SRC}`);
    return nextResolve(pathToFileURL(found).href, context);
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const found = firstExisting(
      join(dirname(fileURLToPath(context.parentURL)), specifier),
    );
    if (found) return nextResolve(pathToFileURL(found).href, context);
  }

  return nextResolve(specifier, context);
}
